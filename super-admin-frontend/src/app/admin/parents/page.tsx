import { Metadata } from "next";
import { Parents } from "@/modules/systemAdmin/page/Parents/Parents";

export const metadata: Metadata = {
  title: "Parents",
};

const ParentsPage = () => <Parents />;

export default ParentsPage;
