import { Metadata } from "next";
import AdminsPage from "@/modules/systemAdmin/page/AdminsPage/AdminsPage";

export const metadata: Metadata = {
  title: "Admins",
};

const Page = () => <AdminsPage />;

export default Page;
