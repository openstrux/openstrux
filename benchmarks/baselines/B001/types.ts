// B001 TypeScript baseline — GrantApplication record type

export interface GrantApplication {
  id:          string;
  title:       string;
  amount:      number;
  status:      string;
  submittedAt: Date;
  applicantId: string;
}
