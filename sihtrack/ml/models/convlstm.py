"""
SIHTRACK Deep Learning Spatio-Temporal Trajectory & Anomaly Prediction Architecture
Implements:
  1. BaseSpatioTemporalModel (Extensible abstract interface for ConvLSTM, Transformer, GNN).
  2. ConvLSTMCell and Multi-layer ConvLSTM (Shi et al., NeurIPS).
  3. ConvLSTMWeatherTracker: sequence-to-sequence prediction model predicting future anomaly grids,
     event centroids (lat, lon), peak intensity, and spatial extent (km²).
"""
import torch
import torch.nn as nn
from typing import Tuple, List, Dict, Any, Optional


class BaseSpatioTemporalModel(nn.Module):
    """
    Extensible interface for spatio-temporal weather anomaly prediction models.
    Supports ConvLSTM, Spatio-Temporal Transformers, and Graph Neural Networks (GNN).
    """

    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.in_channels = in_channels
        self.out_channels = out_channels

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            x: Input tensor [Batch, Sequence_In, Channels, Height, Width]
        Returns:
            grid_pred: Predicted grids [Batch, Sequence_Out, Channels_Out, Height, Width]
            state_pred: Predicted trajectory states [Batch, Sequence_Out, 4] -> (lat, lon, intensity, extent)
        """
        raise NotImplementedError


class ConvLSTMCell(nn.Module):
    """
    Convolutional Long Short-Term Memory (ConvLSTM) cell.
    Replaces matrix multiplication in standard LSTM with 2D convolutions to preserve spatial topology.
    """

    def __init__(self, in_channels: int, hidden_channels: int, kernel_size: int = 3):
        super().__init__()
        self.in_channels = in_channels
        self.hidden_channels = hidden_channels
        self.padding = kernel_size // 2

        self.conv = nn.Conv2d(
            in_channels=in_channels + hidden_channels,
            out_channels=4 * hidden_channels,
            kernel_size=kernel_size,
            padding=self.padding,
            bias=True
        )

    def forward(
        self,
        x: torch.Tensor,
        state: Optional[Tuple[torch.Tensor, torch.Tensor]] = None
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        batch_size, _, height, width = x.size()

        if state is None:
            device = x.device
            h_cur = torch.zeros(batch_size, self.hidden_channels, height, width, device=device)
            c_cur = torch.zeros(batch_size, self.hidden_channels, height, width, device=device)
        else:
            h_cur, c_cur = state

        combined = torch.cat([x, h_cur], dim=1)
        gates = self.conv(combined)

        cc_i, cc_f, cc_o, cc_g = torch.chunk(gates, 4, dim=1)
        i = torch.sigmoid(cc_i)
        f = torch.sigmoid(cc_f)
        o = torch.sigmoid(cc_o)
        g = torch.tanh(cc_g)

        c_next = f * c_cur + i * g
        h_next = o * torch.tanh(c_next)

        return h_next, c_next


class ConvLSTMWeatherTracker(BaseSpatioTemporalModel):
    """
    Two-Stage Deep Learning Spatio-Temporal Weather Trajectory Tracker.
    Input: [Batch, T_in=5, Channels, Height, Width] (e.g. T-24h, T-18h, T-12h, T-6h, T=0h)
    Predicts:
      1. Future spatial anomaly grids: [Batch, T_out=4, 1, Height, Width] (T+6h, T+12h, T+18h, T+24h)
      2. Trajectory centroids & characteristics: [Batch, T_out=4, 4] -> (normalized lat, lon, intensity, extent)
    """

    def __init__(
        self,
        in_channels: int = 6,      # Temp, Precip, U-wind, V-wind, MSLP, Anomaly
        hidden_dim: int = 32,
        seq_in: int = 5,
        seq_out: int = 4,
        img_size: Tuple[int, int] = (64, 64)
    ):
        super().__init__(in_channels=in_channels, out_channels=1)
        self.seq_in = seq_in
        self.seq_out = seq_out
        self.hidden_dim = hidden_dim

        # Encoder ConvLSTM Layers
        self.encoder_cell_1 = ConvLSTMCell(in_channels, hidden_dim, kernel_size=3)
        self.encoder_cell_2 = ConvLSTMCell(hidden_dim, hidden_dim, kernel_size=3)

        # Decoder ConvLSTM Layer
        self.decoder_cell = ConvLSTMCell(hidden_dim, hidden_dim, kernel_size=3)

        # Output spatial projection head
        self.conv_out = nn.Sequential(
            nn.Conv2d(hidden_dim, 16, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(16, 1, kernel_size=1),
            nn.Sigmoid()
        )

        # Trajectory Regressor Head (Centroid lat/lon, intensity, extent)
        self.state_head = nn.Sequential(
            nn.AdaptiveAvgPool2d((4, 4)),
            nn.Flatten(),
            nn.Linear(hidden_dim * 16, 64),
            nn.ReLU(inplace=True),
            nn.Linear(64, 4)  # [lat_norm, lon_norm, intensity_norm, extent_norm]
        )

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        batch_size, seq_len, _, height, width = x.size()

        # Encoder forward pass over history
        h1, c1 = None, None
        h2, c2 = None, None
        for t in range(seq_len):
            x_t = x[:, t]
            h1, c1 = self.encoder_cell_1(x_t, (h1, c1) if h1 is not None else None)
            h2, c2 = self.encoder_cell_2(h1, (h2, c2) if h2 is not None else None)

        # Decoder forward pass for future forecast frames
        h_dec, c_dec = h2, c2
        grid_predictions = []
        state_predictions = []

        cur_input = h2
        for t in range(self.seq_out):
            h_dec, c_dec = self.decoder_cell(cur_input, (h_dec, c_dec))
            pred_grid = self.conv_out(h_dec)  # [B, 1, H, W]
            pred_state = self.state_head(h_dec)  # [B, 4]

            grid_predictions.append(pred_grid)
            state_predictions.append(pred_state)
            cur_input = h_dec

        # Stack predictions across forecast horizon
        out_grids = torch.stack(grid_predictions, dim=1)  # [B, seq_out, 1, H, W]
        out_states = torch.stack(state_predictions, dim=1)  # [B, seq_out, 4]

        return out_grids, out_states
