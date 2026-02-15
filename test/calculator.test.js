/**
 * Copyright (c) 2026 Argenox Technologies LLC. All rights reserved.
 *
 * Unit tests for POE Cascade Calculator (cable loss and chain logic).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { POECalculator } = require('../calculator.js');

const {
  POE_VOLTAGE,
  CABLE_TYPES,
  cablePowerLoss,
  powerAfterCable,
  devicePseOutput,
  calculateChain,
  getCableTypes,
} = POECalculator;

describe('POECalculator constants', () => {
  it('uses 48V nominal POE voltage', () => {
    assert.strictEqual(POE_VOLTAGE, 48);
  });

  it('exposes cable types with resistance per meter', () => {
    const types = getCableTypes();
    assert.ok(types.includes('Cat5e'));
    assert.ok(types.includes('Cat6'));
    assert.ok(types.includes('Cat6a'));
    assert.ok(types.includes('Cat7'));
    assert.ok(CABLE_TYPES.Cat5e.resistancePerMeter > 0);
    assert.ok(CABLE_TYPES.Cat7.resistancePerMeter < CABLE_TYPES.Cat5e.resistancePerMeter);
  });
});

describe('cablePowerLoss', () => {
  it('returns 0 for zero length', () => {
    assert.strictEqual(cablePowerLoss(90, 0, 'Cat5e', true), 0);
  });

  it('increases with length', () => {
    const loss10 = cablePowerLoss(90, 10, 'Cat5e', true);
    const loss100 = cablePowerLoss(90, 100, 'Cat5e', true);
    assert.ok(loss100 > loss10);
    assert.ok(loss10 > 0);
  });

  it('scales with I² (power squared) for same resistance', () => {
    const loss30 = cablePowerLoss(30, 100, 'Cat5e', true);
    const loss90 = cablePowerLoss(90, 100, 'Cat5e', true);
    assert.ok(loss90 > loss30);
    assert.ok(Math.abs(loss90 / loss30 - 9) < 0.1); // (90/30)² = 9
  });

  it('two-pair has lower loss than one-pair for same length', () => {
    const twoPair = cablePowerLoss(90, 100, 'Cat5e', true);
    const onePair = cablePowerLoss(90, 100, 'Cat5e', false);
    assert.ok(onePair > twoPair);
    assert.ok(Math.abs(onePair / twoPair - 2) < 0.1);
  });

  it('defaults to Cat5e for unknown cable type', () => {
    const known = cablePowerLoss(90, 50, 'Cat5e', true);
    const unknown = cablePowerLoss(90, 50, 'UnknownType', true);
    assert.strictEqual(unknown, known);
  });
});

describe('powerAfterCable', () => {
  it('returns wattsIn when length is 0', () => {
    assert.strictEqual(powerAfterCable(30, 0, 'Cat5e', true), 30);
  });

  it('returns wattsIn minus cable loss', () => {
    const after = powerAfterCable(90, 100, 'Cat5e', true);
    const loss = cablePowerLoss(90, 100, 'Cat5e', true);
    assert.ok(after >= 0);
    assert.strictEqual(after, 90 - loss);
  });

  it('does not return negative power', () => {
    const after = powerAfterCable(15, 200, 'Cat5e', true);
    assert.ok(after >= 0);
  });
});

describe('devicePseOutput', () => {
  it('computes (input - draw) * efficiency', () => {
    assert.strictEqual(devicePseOutput(30, 5, 100), 25);
    assert.strictEqual(devicePseOutput(30, 5, 80), 20);
  });

  it('returns 0 when draw exceeds input', () => {
    assert.strictEqual(devicePseOutput(10, 15, 90), 0);
  });

  it('returns 0 when remaining is 0', () => {
    assert.strictEqual(devicePseOutput(10, 10, 80), 0);
  });
});

describe('calculateChain', () => {
  it('returns switch stage only when chain is empty', () => {
    const stages = calculateChain(30, [], {});
    assert.strictEqual(stages.length, 1);
    assert.strictEqual(stages[0].label, 'Switch (PSE)');
    assert.strictEqual(stages[0].pseOut, 30);
    assert.strictEqual(stages[0].powerIn, null);
    assert.strictEqual(stages[0].cableLoss, null);
  });

  it('computes one device with cable', () => {
    const chain = [
      { cableLengthMeters: 50, cableType: 'Cat5e', deviceDrawWatts: 5, efficiencyPercent: 90 },
    ];
    const stages = calculateChain(30, chain, { twoPair: true, cableSituation: 'typical' });
    assert.strictEqual(stages.length, 2);
    assert.strictEqual(stages[0].label, 'Switch (PSE)');
    assert.strictEqual(stages[1].label, 'Device 1');
    assert.ok(stages[1].powerIn === 30);
    assert.ok(stages[1].cableLoss >= 0);
    assert.ok(stages[1].powerAfterCable <= 30);
    assert.strictEqual(stages[1].deviceDraw, 5);
    assert.strictEqual(stages[1].efficiency, 90);
    assert.ok(stages[1].pseOut >= 0);
  });

  it('uses default efficiency 80% when not set', () => {
    const chain = [{ cableLengthMeters: 0, deviceDrawWatts: 10, efficiencyPercent: undefined }];
    const stages = calculateChain(30, chain, {});
    assert.strictEqual(stages[1].efficiency, 80);
    assert.strictEqual(stages[1].pseOut, (30 - 10) * 0.8);
  });

  it('sets marginNote when power is insufficient', () => {
    const chain = [
      { cableLengthMeters: 0, deviceDrawWatts: 50, efficiencyPercent: 80 },
    ];
    const stages = calculateChain(30, chain, {});
    assert.ok(stages[1].marginNote && stages[1].marginNote.includes('Insufficient'));
  });

  it('applies cable situation multiplier to loss', () => {
    const chain = [
      { cableLengthMeters: 100, cableType: 'Cat5e', deviceDrawWatts: 0, efficiencyPercent: 100 },
    ];
    const typical = calculateChain(90, chain, { cableSituation: 'typical' });
    const worst = calculateChain(90, chain, { cableSituation: 'worst' });
    assert.ok(worst[1].cableLoss > typical[1].cableLoss);
  });

  it('chains multiple devices', () => {
    const chain = [
      { cableLengthMeters: 10, cableType: 'Cat6', deviceDrawWatts: 2, efficiencyPercent: 90 },
      { cableLengthMeters: 10, cableType: 'Cat6', deviceDrawWatts: 2, efficiencyPercent: 90 },
    ];
    const stages = calculateChain(30, chain, {});
    assert.strictEqual(stages.length, 3);
    assert.strictEqual(stages[1].label, 'Device 1');
    assert.strictEqual(stages[2].label, 'Device 2');
    assert.ok(stages[2].powerIn > 0);
    assert.ok(stages[2].pseOut >= 0);
  });
});
