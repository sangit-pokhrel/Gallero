import { GridPage } from '../components/GridPage';
import { useFavorites } from '../lib/favorites';

export default function FavoritesScreen() {
  const { favorites } = useFavorites();
  return (
    <GridPage
      source="favorites"
      title="Favorites"
      assets={favorites}
      emptyTitle="No favorites yet"
      emptyBody="Tap the heart on any photo to keep it here."
    />
  );
}
