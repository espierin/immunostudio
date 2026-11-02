# Kleurstijlen uit bestaande projecten

De nieuwe presets gebruiken gecontroleerde lokale bronwaarden. Het UMC-palet heet **UMC Utrecht**: dit is het huidige figuurpalet uit die presentatie, geen claim over een universele officiële huisstijl.

| Preset | Primaire kleuren | Actuele bron |
|---|---|---|
| UMC Utrecht | donkerblauw `#002B49`, blauw `#0077B6`, koraal `#F15B4A`, rand `#D8E3EA` | `Presentaties Hyderabad/Figure_C_UMCU_violin.svg` en `Figure_D_UMCU_bubble.svg` |
| EFI | blauw `#064A89`, koraal `#DE5757`, tekst `#232424`, surface `#F4F6F9` | `EFI EPT platform/efi_style/EFI_STYLE_GUIDE_EN.md`, sectie 3 |
| Nordic Light | achtergrond `#ECEFF4`, surface `#E5E9F0`, tekst `#2E3440`, primair `#5E81AC` | `Tx-SONAR/src/tx_sonar/ui/desktop/theme.py` |
| Nordic Dark | achtergrond `#2E3440`, surface `#3B4252`, tekst `#ECEFF4`, primair `#88C0D0` | dezelfde actuele Tx-SONAR-tokens |

Nordic-accenten: groen `#A3BE8C`, geel `#EBCB8B`, koraal `#BF616A`, paars `#B48EAD`, koelgroen `#8FBCBB`. Alleen stijl- en bronbestanden zijn gebruikt; klinische gegevens zijn niet geraadpleegd.

## Programma-interface

De programma-interface gebruikt permanent de UMC Utrecht-kleurtokens uit de bovenstaande lokale bron: donkerblauwe kopbalk, blauwe acties, witte panelen, lichtblauwe werkruimte en blauwe selectiegrepen. Illustratiestijlen veranderen uitsluitend het tekenblad en de scène.

De symbolische pictogrammen bij Eigenschappen en de bijbehorende gereedschappen komen uit de lokale Inkscape 1.4.2-installatie. De SVG-geometrie is ongewijzigd; CSS-maskers geven ze de UMC-kleur. Bronvermelding en de meegeleverde licentie staan in `public/icons/inkscape/ATTRIBUTION.txt` en `COPYING`.
