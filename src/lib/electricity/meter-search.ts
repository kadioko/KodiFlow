type SearchableMeter = {
  tenant_name: string
  unit_name: string | null
  floor_label: string
  meter_number: string | null
  display_name: string | null
  ledger_tenant_label: string | null
}

export function matchesElectricityMeter(meter: SearchableMeter, unitIdentifier: string | null, query: string): boolean {
  const words = query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = [meter.tenant_name, meter.unit_name, unitIdentifier, meter.floor_label, meter.meter_number, meter.display_name, meter.ledger_tenant_label]
    .filter(Boolean).join(' ').normalize('NFKC').toLocaleLowerCase()
  return words.every((word) => text.includes(word))
}
