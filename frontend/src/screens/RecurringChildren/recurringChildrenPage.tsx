"use client";

import { useParams } from "next/navigation";
import { useQueryService } from "@/utils/hooks/useQueryService";
import { invoiceDynamicEndpoints } from "@/services/invoice.service";
import { ApiMethods } from "@/utils/client";
import { BillingInvoice } from "@/screens/BillingInvoice";

interface InvoiceDetailResponse {
  data?: {
    invoiceNumber?: string;
    billingPeriod?: string | null;
  };
}

// Route: /admin/billing/invoices/[invoiceId]/children
// Renders the existing invoice list screen in "children of recurring parent" mode.
// Fetches the parent invoice so the header can show its number / billing period.
export const RecurringChildrenPage = () => {
  const params = useParams();
  const rawId = params?.invoiceId;
  const invoiceId = Array.isArray(rawId) ? rawId[0] : rawId;

  const { data: parentInvoiceDetails } = useQueryService<object, InvoiceDetailResponse>({
    service: invoiceId
      ? invoiceDynamicEndpoints.getInvoiceById(invoiceId)
      : { path: "", method: ApiMethods.GET },
    options: {
      enabled: Boolean(invoiceId),
      keys: ["recurring-parent", String(invoiceId ?? "")],
    },
  });

  const parentNumber = parentInvoiceDetails?.data?.invoiceNumber;
  const billingPeriod = parentInvoiceDetails?.data?.billingPeriod;
  const parentLabel = parentNumber
    ? billingPeriod
      ? `${parentNumber} (${billingPeriod})`
      : parentNumber
    : null;

  if (!invoiceId) {
    return null;
  }

  return <BillingInvoice parentInvoiceId={invoiceId} parentLabel={parentLabel} />;
};
