export function calculatePricing({
  materials,
  consumables,
  shopRate,
  buildHours,
  floorMargin,
  fairMargin,
  premiumMargin,
  toggleBonus,    // sum of active toggle percentages (added to EVERY tier)
  processorPct,
  processorFixed,
  taxRate,
  floorMinimum,
}) {
  const labor = shopRate * buildHours;
  const baseCost = materials + consumables + labor;
  const tb = toggleBonus || 0;

  function computeTier(tierMargin) {
    const totalMargin = tierMargin + tb;
    let cashPreTax = baseCost * (1 + totalMargin);
    cashPreTax = Math.max(cashPreTax, floorMinimum);

    let processorPreTax = (cashPreTax + processorFixed) / (1 - processorPct);
    processorPreTax = Math.max(processorPreTax, floorMinimum);

    const processorFee = processorPreTax - cashPreTax;
    const cashTax = cashPreTax * taxRate;
    const processorTax = processorPreTax * taxRate;
    const cashTotal = cashPreTax + cashTax;
    const processorTotal = processorPreTax + processorTax;

    return {
      tierMargin,       // just the tier's own margin
      toggleBonus: tb,  // just the toggle add-on
      totalMargin,      // tier + toggles combined
      tierProfit: baseCost * tierMargin,
      toggleAmount: baseCost * tb,
      cashPreTax,
      processorPreTax,
      processorFee,
      cashTax,
      processorTax,
      cashTotal,
      processorTotal,
    };
  }

  const floor = computeTier(floorMargin);
  const fair = computeTier(fairMargin);
  const premium = computeTier(premiumMargin);

  return {
    materials,
    consumables,
    labor,
    baseCost,
    floor,
    fair,
    premium,
  };
}

// Compute the sum of active toggle percentages (used as toggleBonus)
export function computeToggleBonus(toggles, settings, customToggles = []) {
  const builtInValues = {
    handTooling: parseFloat(settings.toggleHandTooling) || 0.15,
    rush: parseFloat(settings.toggleRush) || 0.25,
    premiumLeather: parseFloat(settings.togglePremiumLeather) || 0.15,
    value: parseFloat(settings.toggleValue) || 0.20,
  };
  // Add custom toggle values
  customToggles.forEach((t, i) => { builtInValues[`custom_${i}`] = t.pct; });

  const activeToggles = Object.entries(toggles).filter(([, v]) => v);
  return activeToggles.reduce((acc, [key]) => acc + (builtInValues[key] || 0), 0);
}

// Get list of active toggles with names and amounts (for breakdown display)
export function getActiveToggleDetails(toggles, settings, customToggles = [], baseCost) {
  const builtIn = [
    { key: 'handTooling', name: 'Hand-tooling / carving', pct: parseFloat(settings.toggleHandTooling) || 0.15 },
    { key: 'rush', name: 'Rush turnaround', pct: parseFloat(settings.toggleRush) || 0.25 },
    { key: 'premiumLeather', name: 'Premium / exotic leather', pct: parseFloat(settings.togglePremiumLeather) || 0.15 },
    { key: 'value', name: 'Value (client can afford)', pct: parseFloat(settings.toggleValue) || 0.20 },
  ];
  customToggles.forEach((t, i) => {
    builtIn.push({ key: `custom_${i}`, name: t.name, pct: t.pct });
  });

  return builtIn
    .filter(t => toggles[t.key])
    .map(t => ({ ...t, amount: baseCost * t.pct }));
}

export function computeLeatherCostPerUsableSqFt(rawPrice, sqFt, yieldPct) {
  return rawPrice / (sqFt * yieldPct);
}
