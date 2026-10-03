### A9 → `docs/research/chip-presets.md` (seed; M4 L2 fills per-preset specs)

| Preset / item | Value | Status | Source |
|---|---|---|---|
| Starmind AI1 (spacex.com sheet), default | NVL72 (A1) + 175 kW avg / 250 kW peak / 160 m² / 210 kW solar | CONFIRMED | spacex.com [N12–N15] |
| Starmind AI1 (alternate sheet) | NVL72 + 120 kW avg / 150 kW peak solar / 110 m² | CONFIRMED (secondary) | heise ; Quartz [N14] |
| NVIDIA H100 (Starcloud-1) | Starcloud-1: launched Nov 2 2025, 60 kg, first H100 in space, ~325 km orbit, ~11-month expected life | CONFIRMED | https://www.datacenterdynamics.com/en/news/starcloud-1-satellite-reaches-space-with-nvidia-h100-gpu-now-operating-in-orbit/ [R10] |
| Jetson Orin AGX | TID **functional limit 19 krad(Si) in one test campaign** (Co-60 at AFRL; protons at ProNova for SEE). Slater et al. 2023 IEEE REDW, doi 10.1109/REDW61050.2023.10265818 | CONFIRMED | https://exa.ai/library/publication/hv05wh78v2p ; https://api.crossref.org/works/10.1109/REDW61050.2023.10265818 [R1] |
| Jetson Orin NX / Xavier NX heavy ion | Rodriguez-Ferrandez et al., DFT 2025, doi 10.1109/DFT66274.2025.11257511. Paper exists; boards and results UNVERIFIED | partial | https://researchr.org/publication/RodriguezFerrandezBKTS25 [R2] |
| Jetson Orin NX protons | IOLTS 2024, doi 10.1109/IOLTS60994.2024.10616076. Paper exists; TRIUMF 480 MeV from snippets only (UNVERIFIED) | partial | https://api.crossref.org/works/10.1109/IOLTS60994.2024.10616076 [R3] |
| Orin latch-up (SEL) | n/a. Snippets suggest no SEL on Orin; don't claim latch-up | UNVERIFIED | [R11] |
| Google TPU v6e Trillium | 67 MeV proton test; HBM first irregularity 2 krad(Si); no hard TID failure to 15 krad(Si) (n = 1) | CONFIRMED | Google Suncatcher blog [R6, R8, R9] |
| GPU DRAM soft errors | Sullivan et al. MICRO-54 2021, doi 10.1145/3466752.3480111; IEEE Micro 2022 doi 10.1109/MM.2022.3163122. Paper exists; **HBM2 MBE locality + ECC findings UNVERIFIED** (full text not read) | partial | https://api.crossref.org/works/10.1145/3466752.3480111 ; https://research.nvidia.com/publication/2021-10_characterizing-and-mitigating-soft-errors-gpu-dram [R4, R5] |
| Rad-hard reference processor | to be filled at M4 L2 | UNVERIFIED | n/a |
