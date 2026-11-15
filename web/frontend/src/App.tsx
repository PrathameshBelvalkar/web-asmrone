import { Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { LibraryPage } from './pages/LibraryPage';
import { FeedPage } from './pages/FeedPage';
import { WorkPage } from './pages/WorkPage';
import { ArtistPage } from './pages/ArtistPage';
import { PlaylistPage } from './pages/PlaylistPage';
import { SettingsPage } from './pages/SettingsPage';
import { HistoryPage } from './pages/HistoryPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { MangaBrowsePage } from './pages/manga/MangaBrowsePage';
import { MangaSearchPage } from './pages/manga/MangaSearchPage';
import { MangaTagsPage } from './pages/manga/MangaTagsPage';
import { MangaListPage } from './pages/manga/MangaListPage';
import { MangaGalleryPage } from './pages/manga/MangaGalleryPage';
import { MangaReaderPage } from './pages/manga/MangaReaderPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="feed/:feedId" element={<FeedPage />} />
        <Route path="work/:id" element={<WorkPage />} />
        <Route path="artist/:id" element={<ArtistPage />} />
        <Route path="playlist/:id" element={<PlaylistPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="manga" element={<MangaBrowsePage />} />
        <Route path="manga/search" element={<MangaSearchPage />} />
        <Route path="manga/tags" element={<MangaTagsPage />} />
        <Route path="manga/artists" element={<MangaTagsPage key="artists" fixedKind="artist" />} />
        <Route path="manga/g/:id" element={<MangaGalleryPage />} />
        <Route path="manga/g/:id/read/:page?" element={<MangaReaderPage />} />
        <Route path="manga/:kind/:slug" element={<MangaListPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
