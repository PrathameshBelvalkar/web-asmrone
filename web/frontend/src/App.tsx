import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
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
import { JavNewsPage } from './pages/jav/JavNewsPage';
import { JavNewsPostPage } from './pages/jav/JavNewsPostPage';
import { JavLatestPage } from './pages/jav/JavLatestPage';
import { JavMovieListPage, JavMoviesPage } from './pages/jav/JavMoviesPage';
import { JavMoviePage } from './pages/jav/JavMoviePage';
import { JavIdolPage, JavIdolsPage } from './pages/jav/JavIdolsPage';
import { JavGenresPage } from './pages/jav/JavGenresPage';
import { JavSearchPage } from './pages/jav/JavSearchPage';
import { JavLibraryPage } from './pages/jav/JavLibraryPage';
import { HanimeHomePage } from './pages/hanime/HanimeHomePage';
import { HanimeBrowsePage } from './pages/hanime/HanimeBrowsePage';
import { HanimeGalleryPage, HanimeRandomPage, HanimeSeasonsPage } from './pages/hanime/HanimeGalleryPage';
import { HanimeTitlePage } from './pages/hanime/HanimeTitlePage';
import { HanimeLibraryPage } from './pages/hanime/HanimeLibraryPage';

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
        <Route path="jav" element={<JavNewsPage />} />
        <Route path="jav/news/:yyyy/:mm/:dd/:slug" element={<JavNewsPostPage />} />
        <Route path="jav/latest" element={<JavLatestPage />} />
        <Route path="jav/movies" element={<JavMoviesPage />} />
        <Route path="jav/movies/:by/:slug" element={<JavMovieListPage />} />
        <Route path="jav/movie/:kind/:slug" element={<JavMoviePage />} />
        <Route path="jav/idols" element={<JavIdolsPage />} />
        <Route path="jav/idol/:slug" element={<JavIdolPage />} />
        <Route path="jav/genres" element={<JavGenresPage />} />
        <Route path="jav/search" element={<JavSearchPage />} />
        <Route path="jav/library" element={<JavLibraryPage />} />
        <Route path="hentai" element={<HanimeHomePage />} />
        <Route path="hentai/browse" element={<HanimeGalleryPage />} />
        <Route path="hentai/titles" element={<HanimeBrowsePage />} />
        <Route path="hentai/seasons" element={<HanimeSeasonsPage />} />
        <Route path="hentai/random" element={<HanimeRandomPage />} />
        <Route path="hentai/search" element={<HanimeBrowsePage key="search" search />} />
        <Route path="hentai/tags" element={<Navigate to="/hentai/browse#tags" replace />} />
        <Route path="hentai/studios" element={<Navigate to="/hentai/browse#studios" replace />} />
        <Route path="hentai/title/:slug" element={<HanimeTitlePage />} />
        <Route path="hentai/library" element={<HanimeLibraryPage />} />
        <Route path="hanime/*" element={<OldHentaiAddress />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

/** The Hentai section used to live under `/hanime`; old links and bookmarks land on the same page. */
function OldHentaiAddress() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`${pathname.replace(/^\/hanime/, '/hentai')}${search}${hash}`} replace />;
}
