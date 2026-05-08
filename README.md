# ioBroker.ems

Adapter mit Admin-UI zur Berechnung aus bestehenden Datenpunkten.

## Funktionen

- In der Admin-UI koennen bestehende Quell-Datenpunkte ausgewaehlt werden.
- Pro Zeile kann eine Berechnungsart und ein Ziel-Datenpunktname definiert werden.
- Unterstuetzte Berechnungsarten:
  - `Energie`: Gesamtenergie aus Leistung (Integration in Wh)
  - `EnergieTag`: Tagesenergie aus einem Gesamtenergie-Zaehler (Wh)
  - `Verbrauch`: Leistung aus mehreren Erzeugern/Verbrauchern
  - `Durchschnitt`: Zeitlicher Durchschnitt eines beliebigen Zahlenwerts

## Admin-UI Konfiguration

In der Tabelle `Berechnungen` stehen folgende Spalten zur Verfuegung:

- `Aktiv`: Zeile aktiv/inaktiv
- `Berechnungsart`: `Energie`, `EnergieTag`, `Verbrauch`, `Durchschnitt`
- `Quell-Datenpunkt`: bestehender State (Auswahl in der UI)
- `Ziel-Datenpunktname`:
  - Ohne Punkt (`mein_wert`) wird automatisch `ems.X.calculated.mein_wert` erstellt
  - Mit Punkt (`0_userdata.0.xyz`) wird der volle Name direkt genutzt
- `Typ (nur Verbrauch)`:
  - `Verbraucher (+)` addiert
  - `Erzeuger (-)` subtrahiert
  - Fuer eine gemeinsame Verbrauchsberechnung mehrere Zeilen mit gleichem Zielnamen anlegen
- `Dauer Sek. (nur Durchschnitt)`: Zeitfenster fuer den gleitenden Durchschnitt
- `Nur positive Werte (Energie)`: negative Leistung bei Integration ignorieren

## Formeln

- Energie:

  `energyWh += powerW * deltaTimeHours`

- EnergieTag:

  `energyTodayWh = max(0, totalEnergyWh - dayStartTotalEnergyWh)`

- Verbrauch (mehrere Zeilen, gleiches Ziel):

  `verbrauchW = Summe(Verbraucher) - Summe(Erzeuger)`

- Durchschnitt:

  Zeitgewichteter gleitender Durchschnitt im konfigurierten Fenster.

## Hinweise zur Vorzeichenkonvention

- Fuer konsistente Ergebnisse bei `Verbrauch` sollten alle beteiligten Quellen dieselbe Einheit haben (typisch W).
- Bei `EnergieTag` wird der Tageswert bei Tageswechsel automatisch zurueckgesetzt.

## Start

1. Abhängigkeiten installieren:

   `npm install`

2. Adapter in ioBroker deployen und eine Instanz anlegen.

3. In der Instanz-Konfiguration die State-IDs eintragen.