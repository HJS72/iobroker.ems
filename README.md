# ioBroker.ems

![EMS Icon](admin/ems.svg)

Adapter mit Admin-UI zur Berechnung aus bestehenden Datenpunkten.

## Funktionen

- In der Admin-UI koennen bestehende Quell-Datenpunkte ausgewaehlt werden.
- Pro Zeile kann eine Berechnungsart und ein Ziel-Datenpunktname definiert werden.
- Unterstuetzte Berechnungsarten:
  - `Energie`: Gesamtenergie aus Leistung (Integration in Wh)
  - `EnergieTag`: Tagesenergie aus einem Gesamtenergie-Zaehler (Wh)
  - `Berechnung`: Formel aus mehreren Datenpunkten
  - `Durchschnitt`: Zeitlicher Durchschnitt eines beliebigen Zahlenwerts

## Admin-UI Konfiguration

In der Tabelle `Berechnungen` stehen folgende Spalten zur Verfuegung:

- `Aktiv`: Zeile aktiv/inaktiv
- `Berechnungsart`: `Energie`, `EnergieTag`, `Berechnung`, `Durchschnitt`
- `Quell-Datenpunkt`: bestehender State (Auswahl in der UI)
- `Ziel-Datenpunktname`:
  - Ohne Punkt (`mein_wert`) wird automatisch `ems.0.mein_wert` erstellt
  - Mit Punkt (`0_userdata.0.xyz`) wird der volle Name direkt genutzt
- `Formel (nur Berechnung)`: z.B. `ems.0.grid + ems.0.battery - ems.0.pv`
- `Dauer Sek. (nur Durchschnitt)`: Zeitfenster fuer den gleitenden Durchschnitt
- `Nur positive Werte (Energie)`: negative Leistung bei Integration ignorieren
- `Einheit`: frei definierbare Ausgabeeinheit pro Zeile

## Formeln

- Energie:

  `energyWh += powerW * deltaTimeHours`

- EnergieTag:

  `energyTodayWh = max(0, totalEnergyWh - dayStartTotalEnergyWh)`

- Berechnung:

  `result = source1 +/- source2 +/- source3`

- Durchschnitt:

  Zeitgewichteter gleitender Durchschnitt im konfigurierten Fenster.

## Hinweise zur Vorzeichenkonvention

- Fuer konsistente Ergebnisse bei `Berechnung` sollten alle beteiligten Quellen dieselbe Einheit haben (typisch W).
- Bei `EnergieTag` wird der Tageswert bei Tageswechsel automatisch zurueckgesetzt.

## Start

1. Abhängigkeiten installieren:

   `npm install`

2. Adapter in ioBroker deployen und eine Instanz anlegen.

3. In der Instanz-Konfiguration die State-IDs eintragen.