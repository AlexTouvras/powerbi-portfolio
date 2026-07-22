export type Stock = {
  ticker: string;
  yahoo: string;
  name: string;
  country: string;
  sector: string;
  industry: string;
  marketCapEURm: number;
  changePct: number | null;
  close: number | null;
  domain: string | null;
  logoUrl: string | null;
};

export type Board = {
  asOf: string;
  generatedAt: string;
  universe: string;
  count: number;
  stocks: Stock[];
};
