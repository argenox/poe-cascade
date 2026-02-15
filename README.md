# POE Cascade Calculator

**Author:** Argenox Technologies LLC

Electron app to model a **Power over Ethernet (POE) cascade**: a network switch (PSE) → cable → N devices, where each device is POE-powered (PD) and can power the next (PSE). It helps you see how many devices can be chained and where power runs out.

## Features

- **Switch (PSE)** – Set total PSE output (e.g. 15.4W af, 30W at, 60/90W bt).
- **Add/remove devices** – Each device has:
  - **Wattage draw** – Power consumed by the device.
  - **Efficiency** – Power supply efficiency (e.g. 80%, 90%) for the part passed to the next stage.
- **Cable between stages** – Length (meters) and type (Cat5e, Cat6, Cat6a, Cat7). Cable loss is computed from resistance and current.
- **Power flow table** – Per stage: power in, cable loss, power after cable, device draw, efficiency, PSE out, and a short margin note.
- **Summary** – Whether the chain is OK, at limit, or underpowered, and remaining watts after the last device.

## How it works

1. **Cable loss** – \( P_{loss} = I^2 R \), with \( I = P/V \) (48 V). Resistance per meter depends on cable type (e.g. Cat5e ≈ 0.094 Ω/m loop).
2. **Each device** – Power in (after cable) minus device draw, then multiplied by efficiency to get PSE output to the next cable/device.

So you can tune switch power, device draw, efficiency, cable length, and cable type to see how many devices can be cascaded.

## Run

```bash
npm install
npm start
```

## Versioning

The app version is defined in `package.json` (`version`). It is used by electron-builder for installers and is shown in the app header and window title. Bump the version in `package.json` before building releases.

## Tech

- **Electron** – Desktop app.
- **Vanilla JS** – No build step; `calculator.js` (cable + chain math), `renderer.js` (UI and state).

---

**Disclaimer:** This tool is for planning and estimation only. The authors and contributors are not responsible for any results, decisions, or outcomes from using this software. Always verify power budgets, cable specs, and device ratings against manufacturer data and applicable standards before designing or installing POE systems.
