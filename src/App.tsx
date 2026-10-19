import { LazyMotion, domAnimation, MotionConfig, AnimatePresence, m } from "motion/react";
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
  const route = useRoute();
  return (
    <SettingsProvider>
      <MotionConfig reducedMotion="user">
        <LazyMotion features={domAnimation} strict>
          <div className="aurora" aria-hidden="true" />
          <div className="relative z-10 mx-auto min-h-full max-w-md">
            <ErrorBoundary>
              <AnimatePresence mode="wait" initial={false}>
                <m.div
                  key={route.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <Screen />
                </m.div>
              </AnimatePresence>
            </ErrorBoundary>
          </div>
          <TabBar />
        </LazyMotion>
      </MotionConfig>
    </SettingsProvider>
  );
}
