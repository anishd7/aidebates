import DebateView from "@/components/debate/DebateView";

interface DebatePageProps {
  params: { id: string };
}

export default function DebatePage({ params }: DebatePageProps) {
  return (
    <div className="h-full">
      <DebateView debateId={params.id} />
    </div>
  );
}
