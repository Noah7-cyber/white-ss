import { Metadata } from "next";
import TeachersPage from "@/modules/systemAdmin/page/TeacherPage/TeacherPage";

export const metadata: Metadata = {
  title: "Teachers",
};

const Page = () => <TeachersPage />;

export default Page;
