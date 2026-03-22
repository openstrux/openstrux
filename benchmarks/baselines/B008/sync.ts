// B008 TypeScript baseline — sync-to-analytics with inline connection config

import { PrismaClient } from "@prisma/client";
import { BigQuery }     from "@google-cloud/bigquery";

function getProductionDb() {
  return new PrismaClient();
}

function getAnalyticsBigQuery() {
  return new BigQuery({
    projectId: process.env.BQ_PROJECT,
    location: "EU",
    // credentials via ADC
  });
}

export async function syncToAnalytics(): Promise<void> {
  const db      = getProductionDb();
  const bq      = getAnalyticsBigQuery();
  const dataset = bq.dataset("grants");

  const applications = await db.grantApplication.findMany();

  const table = dataset.table("grant_applications");
  await table.insert(
    applications.map((app) => ({
      id:          app.id,
      title:       app.title,
      amount:      app.amount,
      status:      app.status,
      submittedAt: app.submittedAt.toISOString(),
      applicantId: app.applicantId,
    }))
  );

  await db.$disconnect();
}
