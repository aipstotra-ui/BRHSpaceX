### A6 → `docs/research/benchmarks.md` (literature reference lines, **not** pass gates) [Researchy §6]

| Target | Paper | Setup | Reported | Source |
|---|---|---|---|---|
| Kp 3 h / 6 h | Zhelavskaya et al. 2019, *Space Weather* 17:1461, doi 10.1029/2019SW002271 | GB/NN/LR on OMNI features, K-fold CV (validation, Table A1) | **3 h:** GB RMSE 0.674, CC 0.872; NN 0.696 / 0.863; persistence 0.847 / 0.808. **6 h:** GB 0.879 / 0.770; persistence 1.077 / 0.690 | https://gfzpublic.gfz-potsdam.de/rest/items/item_4768924_5/component/file_4815891/content |
| Kp 3 h probabilistic | Chakraborty & Morley 2020, *JSWSC*, doi 10.1051/swsc/2020037 | LSTM/GP, ± GOES X-ray | RMSE 0.78 → 0.77, CC 0.82 → 0.83 with X-ray. Storm-time (Kp ≥ 5) RMSE 1.48 → 0.90, CC 0.69 → 0.75. F1 (Kp ≥ 5) 0.56 → 0.60 | https://laro.lanl.gov/view/pdfCoverPage?download=true&filePid=13158263050003761&instCode=01LANL_INST |
| Dst 1–6 h | Gruet et al. 2018, *Space Weather*, doi 10.1029/2018SW001898 | LSTM + GP, OMNI + GPS TEC | **6 h: CC 0.873, RMSE 9.86 nT**. Comparisons at 6 h: Lazzús 2017 0.826 / 13.09; Bala & Reiff 2012 0.77 / 11.09. Per-hour values UNVERIFIED (snippet only) | https://ir.cwi.nl/pub/28241/28241.pdf |
| SEP next day | Sadykov et al. 2021, arXiv 2107.03911 | daily, 2010–2019, ~1:34 imbalance | ML TSS 0.820, HSS2 0.635, AUC 0.959. **NOAA SWPC TSS 0.786, HSS2 0.748, AUC 0.919**. Persistence TSS 0.647, HSS2 0.647 | https://arxiv.org/abs/2107.03911 |

How to read these: datasets and periods differ, so these are "literature reference" lines, not head-to-head scores. For SEP, report both TSS and HSS. Not verified: Bain et al. 2021 (doi 10.1029/2020SW002670, not opened), and the NOAA RSGA probability files (ftp unreachable).
