import { notFound } from 'next/navigation';
import { SharedDesignView } from '@/components/share/shared-design-view';

interface PageProps {
  params: Promise<{ uuid: string }>;
}

async function getSharedDesign(uuid: string) {
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

  try {
    const res = await fetch(`${baseUrl}/api/share/${uuid}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      return null;
    }

    return res.json();
  } catch (error) {
    console.error('Failed to fetch shared design:', error);
    return null;
  }
}

export default async function SharePage({ params }: PageProps) {
  const { uuid } = await params;
  const data = await getSharedDesign(uuid);

  if (!data) {
    notFound();
  }

  return (
    <SharedDesignView
      projectName={data.project.name}
      preferences={data.project.preferences}
      rooms={data.rooms}
    />
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { uuid } = await params;
  const data = await getSharedDesign(uuid);

  if (!data) {
    return {
      title: 'Design Not Found',
    };
  }

  return {
    title: `${data.project.name} - Interior Design`,
    description: `View the interior design for ${data.project.name}`,
  };
}
