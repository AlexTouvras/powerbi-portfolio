"""Shared ink for the argument-page figures."""

import matplotlib.pyplot as plt

INK = "#1F2A33"
MUTED = "#5A6B75"
RULE = "#D5DEE4"
PALETTE = ("#2F5F73", "#C17B3A", "#1B7A4E", "#8C3A4A", "#3E5C76", "#6E5A3A", "#4E6B62", "#7A4E62")

plt.rcParams.update(
    {
        "font.family": "DejaVu Serif",
        "text.color": INK,
        "axes.labelcolor": INK,
        "xtick.color": INK,
        "ytick.color": INK,
        "axes.edgecolor": INK,
        "axes.linewidth": 0.6,
        "figure.facecolor": "white",
        "axes.facecolor": "white",
        "axes.spines.top": False,
        "axes.spines.right": False,
    }
)
