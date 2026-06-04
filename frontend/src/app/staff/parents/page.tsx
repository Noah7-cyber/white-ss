import { Metadata } from "next";
import { StaffParents } from "@/modules/staff/page/Parents/StaffParents";

export const metadata: Metadata = {
  title: "Parents",
};

const StaffParentsPage = () => <StaffParents />;

export default StaffParentsPage;
