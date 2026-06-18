import { Metadata } from "next";
import { ParentRecurringChildrenPage } from "@/screens/RecurringChildren";

export const metadata: Metadata = {
  title: "Recurring Invoice Children",
};

const Page = () => <ParentRecurringChildrenPage />;

export default Page;
