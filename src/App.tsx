import { SettingsProvider } from "./app/settings-ctx";
import { useRoute } from "./app/router";
import { TabBar } from "./components/TabBar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import HomeScreen from "./features/home/HomeScreen";
import ReaderScreen from "./features/reader/ReaderScreen";
import SearchScreen from "./features/search/SearchScreen";
import LibraryScreen from "./features/library/LibraryScreen";
import TranslationsScreen from "./features/translations/TranslationsScreen";
import SettingsScreen from "./features/settings/SettingsScreen";

function Screen() {
  const route = useRoute();
  switch (route.name) {
    case "read":
      return <ReaderScreen route={route} />;
    case "search":
      return <SearchScreen initialQuery={route.q} />;
    case "library":
      return <LibraryScreen />;
    case "translations":
      return <TranslationsScreen />;
    case "settings":
      return <SettingsScreen />;
    default:
      return <HomeScreen />;
  }
}

export default function App() {
  return (
    <SettingsProvider>
      <div className="mx-auto min-h-full max-w-md">
        <ErrorBoundary>
          <Screen />
        </ErrorBoundary>
      </div>
      <TabBar />
    </SettingsProvider>
  );
}
