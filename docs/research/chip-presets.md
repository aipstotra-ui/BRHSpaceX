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

### M4 L2 researcher

TARGET: docs/research/chip-presets.md

| Item | Value | Unit | Source URL | Accessed | Status | Note |
|---|---|---|---|---|---|---|
| H100 SXM memory | 80 GB HBM3 (five stacks) | GB | https://advancedclustering.com/wp-content/uploads/2022/03/gtc22-whitepaper-hopper.pdf | 2026-10-03 | CONFIRMED | NVIDIA Hopper architecture whitepaper. SXM5. Live product page lists the same 80GB without repeating HBM3: https://www.nvidia.com/en-us/data-center/h100/ |
| H100 SXM memory bandwidth | 3.35TB/s | TB/s | https://www.nvidia.com/en-us/data-center/h100/ | 2026-10-03 | CONFIRMED | Shipping product table. Whitepaper table value 3000 GB/sec is marked Not Finalized. |
| H100 SXM max TDP | Up to 700W (configurable) | W | https://www.nvidia.com/en-us/data-center/h100/ | 2026-10-03 | CONFIRMED | Shipping product table. Whitepaper comparison table also prints 700 Watts for the HBM3 column. |
| H100 process node | TSMC 4N customized for NVIDIA | n/a | https://advancedclustering.com/wp-content/uploads/2022/03/gtc22-whitepaper-hopper.pdf | 2026-10-03 | CONFIRMED | Body: "Using the TSMC 4N fabrication process". Applies to SXM5 and PCIe columns. Not N3. |
| H100 ECC | SECDED, sideband ECC on HBM3/HBM2e; SECDED also on L2, L1, and SM register files | scheme | https://advancedclustering.com/wp-content/uploads/2022/03/gtc22-whitepaper-hopper.pdf | 2026-10-03 | CONFIRMED | Vendor uses the word SECDED. Row remapping is separate from the code. |
| H100 PCIe, architecture sheet | 80 GB HBM2e; TDP 350 Watts | GB; W | https://advancedclustering.com/wp-content/uploads/2022/03/gtc22-whitepaper-hopper.pdf | 2026-10-03 | CONFIRMED | Whitepaper says the PCIe H100 "provides 80 GB of fast HBM2e" and "350 Watts". Table footnote: preliminary and subject to change. |
| H100 NVL, current PCIe product | 94GB; max TDP 350-400W (configurable); PCIe dual-slot air-cooled | GB; W | https://www.nvidia.com/en-us/data-center/h100/ | 2026-10-03 | CONFIRMED | Live product table. A separate sentence on the same page says the H100 NVL uses 188GB HBM3 for the Llama 2 70B two-GPU bridge case. |
| Starcloud-1 H100 board form factor | n/a | n/a | https://blogs.nvidia.com/blog/starcloud/ | 2026-10-03 | UNVERIFIED | NVIDIA blog and https://www.starcloud.com/starcloud-1 say H100 and do not say SXM or PCIe. Do not assign 700 W or 350 W to the flight unit. |
| H100 SEU cross-section | n/a | n/a | https://www.nvidia.com/en-us/data-center/h100/ | 2026-10-03 | UNVERIFIED | No published proton or heavy-ion SEU cross-section for H100/Hopper was found. |
| Jetson AGX Orin 64GB memory | 64GB 256-bit LPDDR5 | GB | https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/5380/Jetson_AGX_Orin_Series_Data_Sheet_DS-10662-001_v1.5.pdf | 2026-10-03 | CONFIRMED | Datasheet DS-10662-001 v1.5. 32GB module is 32GB 256-bit LPDDR5. |
| Jetson AGX Orin 64GB module power | 15 W, 30 W, 50 W, and up to 60 W | W | https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/5380/Jetson_AGX_Orin_Series_Data_Sheet_DS-10662-001_v1.5.pdf | 2026-10-03 | CONFIRMED | Same datasheet: 32GB maximum module power up to 40 W. |
| Jetson AGX Orin Industrial memory and power | 64GB 256-bit LPDDR5 with ECC Support; maximum module power up to 75 W | GB; W | https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/5380/Jetson_AGX_Orin_Series_Data_Sheet_DS-10662-001_v1.5.pdf | 2026-10-03 | CONFIRMED | Datasheet prints "ECC Support" and "(+ECC)" only on JAOi, not on JAO 64GB or 32GB. |
| Orin SoC process node | Samsung 8nm | n/a | https://hc34.hotchips.org/assets/program/conference/day2/ADAS%20and%20Grace/HC2022.NVIDIA.Mike_Ditty.v6.pdf | 2026-10-03 | CONFIRMED | NVIDIA Hot Chips 2022 Orin slide, "Process: Samsung 8nm". NX datasheet calls NX a low-power version of the same Orin SoC. |
| Orin DRAM-ECC scheme | Single-bit correct, double-bit detect; 2 ECC bytes per 32 data bytes | scheme | https://docs.nvidia.com/jetson/archives/r36.4.3/DeveloperGuide/SD/Bootloader/DramEcc.html | 2026-10-03 | CONFIRMED | Vendor does not name SECDED. Enabling ECC reduces usable memory to 7/8. Datasheet attaches ECC Support to JAOi only. |
| Jetson AGX Orin 64GB/32GB ECC | n/a | n/a | https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/5380/Jetson_AGX_Orin_Series_Data_Sheet_DS-10662-001_v1.5.pdf | 2026-10-03 | UNVERIFIED | Commercial module lines do not state DRAM ECC. Do not record "none". |
| Jetson AGX Orin SEU cross-section | n/a | n/a | https://doi.org/10.1109/REDW61050.2023.10265818 | 2026-10-03 | UNVERIFIED | Seed TID 19 krad(Si) stands. No AGX cross-section with particle energy was on a page opened here. Do not copy the NX number onto AGX. |
| Jetson Orin NX 16GB memory | 16 GB 128-bit LPDDR5; peak bandwidth 102 GB/s; up to 3200 MHz | GB; GB/s; MHz | https://developer.nvidia.com/downloads/jetson-orin-nx-module-series-data-sheet | 2026-10-03 | CONFIRMED | DS-10712-001 v1.7. 8GB module is 8 GB 128-bit LPDDR5, same peak bandwidth figure. |
| Jetson Orin NX 16GB power modes | 10W, 15W, 25W, 40W (MAXN_SUPER) | W | https://developer.nvidia.com/downloads/jetson-orin-nx-module-series-data-sheet | 2026-10-03 | CONFIRMED | 8GB modes: 10W, 15W, 20W, 40W (MAXN_SUPER). |
| Jetson Orin NX DRAM ECC | n/a | n/a | https://developer.nvidia.com/downloads/jetson-orin-nx-module-series-data-sheet | 2026-10-03 | UNVERIFIED | Module datasheet does not state DRAM ECC. Unknown, not "none". |
| Jetson Orin NX GPU SEU cross-section | 3.52 × 10−10 | cm2 | https://upcommons.upc.edu/bitstreams/ef814395-1619-43ee-ba00-6a89f0c16d83/download | 2026-10-03 | CONFIRMED | Rodriguez-Ferrandez et al., IOLTS 2024, doi 10.1109/IOLTS60994.2024.10616076. 480 MeV protons, TRIUMF BL1B. Table IV GPU SEU, device cm2, not cm2/bit. Printed fluence 1.99 × 10^10 p/cm2. Bounds 1.42 × 10−10 to 7.26 × 10−10 cm2. |
| Jetson Orin NX SoC SEU cross-section, 15W | 3.90 × 10−9 | cm2 | https://upcommons.upc.edu/bitstreams/ef814395-1619-43ee-ba00-6a89f0c16d83/download | 2026-10-03 | CONFIRMED | Same paper, Table II, 480 MeV protons. Device cm2. 10W mode is 4.43 × 10−9 cm2; SUB 10W is 2.50 × 10−9 cm2. |
| Orin latch-up | n/a | n/a | https://upcommons.upc.edu/bitstreams/ef814395-1619-43ee-ba00-6a89f0c16d83/download | 2026-10-03 | UNVERIFIED | Same paper could not attribute POWER2 current spikes to SEL. Do not upgrade the seed. |
| TPU v6e Trillium HBM capacity | 32 GB | GB | https://docs.cloud.google.com/tpu/docs/v6e | 2026-10-03 | CONFIRMED | "HBM capacity per chip". Generation (HBM2e/HBM3) is not stated. |
| TPU v6e Trillium HBM bandwidth | 1638 GBps | GBps | https://docs.cloud.google.com/tpu/docs/v6e | 2026-10-03 | CONFIRMED | "HBM bandwidth per chip". |
| TPU v6e process node | n/a | n/a | https://docs.cloud.google.com/tpu/docs/v6e | 2026-10-03 | UNVERIFIED | Google Cloud docs and the Trillium blog do not state a process node. |
| TPU v6e power | n/a | n/a | https://docs.cloud.google.com/tpu/docs/v6e | 2026-10-03 | UNVERIFIED | No TDP or watt figure on the Cloud docs or Suncatcher blog. |
| TPU v6e ECC | n/a | n/a | https://docs.cloud.google.com/tpu/docs/v6e | 2026-10-03 | UNVERIFIED | Vendor does not state SECDED, chipkill, or none. |
| TPU v6e SEU cross-section | n/a | n/a | https://research.google/blog/exploring-a-space-based-scalable-ai-infrastructure-system-design/ | 2026-10-03 | UNVERIFIED | 67 MeV proton test is published. No cross-section. Seed TID points stand: HBM irregularity 2 krad(Si); no hard TID failure to 15 krad(Si), n=1. |
| Microchip SAMRH71 on-chip memory | Flash 128 Kbytes; TCM SRAM 384 Kbytes; multiport SRAM 768 Kbytes; I-cache 16 Kbytes; D-cache 16 Kbytes | Kbyte | https://www.microchip.com/DS60001593 | 2026-10-03 | CONFIRMED | Datasheet DS60001593. Core is Arm Cortex-M7 at 100 MHz typical. |
| Microchip SAMRH71 ECC | Flash ECC up to 2-error correction; TCM and multiport SRAM ECC up to 1-error correction; cache ECC; HEMC ECC up to 2 bits per 32 bits | scheme | https://www.microchip.com/DS60001593 | 2026-10-03 | CONFIRMED | Vendor does not name SECDED. Also "SEU detection through ECC protection (up to 2 corrections)" and hardware scrubbing. |
| Microchip SAMRH71 TID | 100 Krad(si) | Krad(si) | https://www.microchip.com/DS60001593 | 2026-10-03 | CONFIRMED | Revisions C and E. Test method ESCC-22900. Datasheet spelling "Krad(si)". |
| Microchip SAMRH71 rev C SEL | No SEL below LET 62.5 MeV.cm2/mg at 125°C | MeV.cm2/mg | https://www.microchip.com/DS60001593 | 2026-10-03 | CONFIRMED | Revision E: no SEL below LET 78 MeV.cm2/mg at 125°C. This is an SEL LET limit, not an SEU cross-section. |
| Microchip SAMRH71 SEU cross-section | n/a | n/a | https://www.microchip.com/DS60001593 | 2026-10-03 | UNVERIFIED | Datasheet: "Detailed results about TID, SEL, and SEU available upon request." No public cm2/bit value. |
| Microchip SAMRH71 process node | n/a | n/a | https://www.microchip.com/DS60001593 | 2026-10-03 | UNVERIFIED | Datasheet text opened here does not state a process node. |
| Microchip SAMRH71 power | n/a | n/a | https://www.microchip.com/DS60001593 | 2026-10-03 | UNVERIFIED | Supply ranges are printed (VDDIO 3.0V to 3.6V; VDDCORE 1.65V to 1.95V). No watt or milliamp figure was in the extracted text. |

BLOCKING: no

