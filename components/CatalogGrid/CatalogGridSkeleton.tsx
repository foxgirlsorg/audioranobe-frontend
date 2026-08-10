import CardGrid from '@/components/CardGrid/CardGrid';
import TitleCardSkeleton from '@/components/TitleCardC/TitleCardSkeleton';

export function CatalogGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <CardGrid fill>
      {Array.from({ length: count }, (_, i) => (
        <TitleCardSkeleton key={i} />
      ))}
    </CardGrid>
  );
}

export default CatalogGridSkeleton;
