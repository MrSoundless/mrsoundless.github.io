import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { emptyData, type Bucket, type Data, type RecordType } from "./domain";

type Store = {
  data: Data;
  user: User | null;
  demo: boolean;
  ready: boolean;
  configured: boolean;
  loading: boolean;
  busy: boolean;
  online: boolean;
  error: string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  startDemo: () => void;
  save: (bucket: Bucket, value: RecordType) => Promise<void>;
  remove: (bucket: Bucket, id: string) => Promise<void>;
  clearError: () => void;
};
const Context = createContext<Store>(null!);
let auth: Auth | undefined;
let db: Firestore | undefined;
async function setup() {
  const response = await fetch(
    `${import.meta.env.BASE_URL}firebase-config.json`,
  );
  if (!response.ok)
    throw new Error("Unable to load the sign-in configuration. Please reload.");
  const config = (await response.json()) as FirebaseOptions;
  if (
    !config.apiKey ||
    !config.projectId ||
    !config.authDomain ||
    !config.appId
  )
    return false;
  const app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  return true;
}
const configuration = setup();
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(emptyData);
  const [user, setUser] = useState<User | null>(null);
  const [demo, setDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    let unsubscribe = () => {};
    let active = true;
    configuration
      .then((enabled) => {
        if (!active) return;
        setConfigured(enabled);
        if (enabled && auth)
          unsubscribe = onAuthStateChanged(auth, (next) => {
            setData(emptyData());
            setUser(next);
            setReady(true);
            setLoading(!!next);
          });
        else {
          setReady(true);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setReady(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!user || !db || demo) return;
    let active = true;
    const loaded = new Set<string>();
    const unsubscribes = (Object.keys(emptyData()) as Bucket[]).map((bucket) =>
      onSnapshot(
        collection(db!, "users", user.uid, bucket),
        (snapshot) => {
          if (!active) return;
          setData((current) => ({
            ...current,
            [bucket]: snapshot.docs.map((d) => ({ ...d.data(), id: d.id })),
          }));
          loaded.add(bucket);
          if (loaded.size === 4) setLoading(false);
        },
        (e) => {
          if (active) {
            setError(`Could not synchronize your data: ${e.message}`);
            setLoading(true);
          }
        },
      ),
    );
    return () => {
      active = false;
      unsubscribes.forEach((fn) => fn());
    };
  }, [user, demo]);
  async function mutate(action: () => Promise<void>) {
    if (!demo && (!online || !user || !db || loading))
      throw new Error(
        "Connect to the internet and wait for your account to finish loading before saving.",
      );
    setPending((n) => n + 1);
    try {
      await action();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Unable to save changes.";
      setError(message);
      throw e;
    } finally {
      setPending((n) => n - 1);
    }
  }
  const value: Store = {
    data,
    user,
    demo,
    ready,
    configured,
    loading,
    busy: pending > 0,
    online,
    error,
    clearError: () => setError(""),
    login: async () => {
      try {
        if (auth) await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Sign-in failed. Allow popups and try again.",
        );
      }
    },
    logout: async () => {
      if (auth && user) await signOut(auth);
      setDemo(false);
      setData(emptyData());
      setLoading(false);
    },
    startDemo: () => {
      setData(emptyData());
      setDemo(true);
      setLoading(false);
      setError("");
    },
    save: (bucket, value) =>
      mutate(async () => {
        if (demo)
          setData((current) => ({
            ...current,
            [bucket]: [
              ...current[bucket].filter((item) => item.id !== value.id),
              structuredClone(value),
            ],
          }));
        else
          await setDoc(doc(db!, "users", user!.uid, bucket, value.id), value);
      }),
    remove: (bucket, id) =>
      mutate(async () => {
        if (demo)
          setData((current) => ({
            ...current,
            [bucket]: current[bucket].filter((item) => item.id !== id),
          }));
        else await deleteDoc(doc(db!, "users", user!.uid, bucket, id));
      }),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useStore = () => useContext(Context);
