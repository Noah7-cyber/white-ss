import { FormSubmissionsPage } from "@/screens/AdmissionForms";

export const dynamic = 'force-dynamic';

const Page = async (props: { searchParams: Promise<{ template?: string }> }) => {
  const searchParams = await props.searchParams;
  if (searchParams.template === "admission") {
    return (
      <FormSubmissionsPage 
        initialFormTitle="Admission Form"
        initialFormDescription="Please fill out the following details to apply for admission."
        initialQuestions={[
          { id: 1, type: "short", title: "Child First Name", required: true },
          { id: 2, type: "short", title: "Child Last Name", required: true },
          { id: 3, type: "short", title: "Child Middle Name", required: false },
          { id: 4, type: "date", title: "Child Date of Birth", required: true },
          { id: 5, type: "image_upload", title: "Child Profile Picture", required: false },
          { id: 6, type: "long", title: "Child Address", required: false },
          { id: 7, type: "long", title: "Allergies", required: false },
          { id: 8, type: "long", title: "Medications", required: false },
          { id: 9, type: "long", title: "Food Preferences", required: false },
          { id: 10, type: "long", title: "Diet Restrictions", required: false },
          { id: 11, type: "long", title: "Notes", required: false },

          { id: 19, type: "multiple", title: "Parent Title", required: false, options: ["Mr.", "Mrs.", "Ms.", "Miss", "Dr.", "Prof."] },
          { id: 20, type: "short", title: "Parent First Name", required: true },
          { id: 21, type: "short", title: "Parent Last Name", required: true },
          { id: 22, type: "short", title: "Parent Email", required: true },
          { id: 23, type: "short", title: "Parent Phone", required: true },
          { id: 24, type: "multiple", title: "Parent Relationship", required: false, options: ["Mother", "Father", "Guardian", "Grandparent", "Aunt/Uncle", "Other"] },
          { id: 25, type: "long", title: "Parent Address", required: false },
          { id: 26, type: "file_upload", title: "Birth Certificate", required: false },
          { id: 27, type: "file_upload", title: "Immunization Record", required: false },
        ]}
      />
    );
  }
  
  return <FormSubmissionsPage />;
}

export default Page;
