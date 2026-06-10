import { formatCalculatorZar } from "./calculatorResultsPresentation";

type TransferBreakdown = {
  transferCosts: {
    transferDuty: number;
    transferAttorneyFee: number;
    transferAttorneyFeeVat: number;
    deedsOfficeTransferFee: number;
    municipalRatesClearanceProvision: number;
    postagesAndPettiesEstimate: number;
    ficaFeeEstimate: number;
    deedsSearchFeeEstimate: number;
    electronicInstructionFeeEstimate: number;
    transferSubtotal: number;
  };
  bondCosts: {
    bondAttorneyFee: number;
    bondAttorneyFeeVat: number;
    deedsOfficeBondFee: number;
    bondSubtotal: number;
  };
};

export function buildTransferBondBreakdownRows(breakdown: TransferBreakdown) {
  const { transferCosts: t, bondCosts: b } = breakdown;
  const fmt = (val: number) => (typeof val === "number" ? formatCalculatorZar(val) : "—");

  return [
    { label: "Transfer duty", value: fmt(t.transferDuty), variant: "detail" as const },
    { label: "Transfer attorney (ex VAT)", value: fmt(t.transferAttorneyFee), variant: "detail" as const },
    { label: "VAT on transfer attorney", value: fmt(t.transferAttorneyFeeVat), variant: "detail" as const },
    { label: "Deeds Office transfer fee", value: fmt(t.deedsOfficeTransferFee), variant: "detail" as const },
    {
      label: "Municipal / rates clearance provision",
      value: fmt(t.municipalRatesClearanceProvision),
      variant: "detail" as const
    },
    { label: "Postages & petties", value: fmt(t.postagesAndPettiesEstimate), variant: "detail" as const },
    { label: "FICA estimate", value: fmt(t.ficaFeeEstimate), variant: "detail" as const },
    { label: "Deeds search estimate", value: fmt(t.deedsSearchFeeEstimate), variant: "detail" as const },
    {
      label: "Electronic instruction estimate",
      value: fmt(t.electronicInstructionFeeEstimate),
      variant: "detail" as const
    },
    { label: "Transfer subtotal", value: fmt(t.transferSubtotal), variant: "subtotal" as const },
    { label: "Bond attorney (ex VAT)", value: fmt(b.bondAttorneyFee), variant: "detail" as const },
    { label: "VAT on bond attorney", value: fmt(b.bondAttorneyFeeVat), variant: "detail" as const },
    { label: "Deeds Office bond fee", value: fmt(b.deedsOfficeBondFee), variant: "detail" as const },
    { label: "Bond subtotal", value: fmt(b.bondSubtotal), variant: "subtotal" as const }
  ];
}
