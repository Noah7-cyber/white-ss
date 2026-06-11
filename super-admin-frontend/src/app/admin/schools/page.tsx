import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Schools",
};

const Page = () => {
  return (
    <div className="flex flex-col gap-6 p-5">
      <h1 className="text-xl font-semibold text-text-primary">Schools</h1>
      <div className="bg-white p-6 rounded-2xl border border-border-table">
        <p className="text-gray-500">Global school overview goes here.</p>
      </div>
    </div>
  );
};

export default Page;