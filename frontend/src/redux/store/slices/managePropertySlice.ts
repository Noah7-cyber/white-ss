/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import createWebStorage from "redux-persist/lib/storage/createWebStorage";
import { PersistConfig, persistReducer } from "redux-persist";

const createNoopStorage = () => {
  return {
    getItem(_key: any) {
      return Promise.resolve(null);
    },
    setItem(_key: any, value: any) {
      return Promise.resolve(value);
    },
    removeItem(_key: any) {
      return Promise.resolve();
    },
  };
};

const storage = typeof window !== "undefined" ? createWebStorage("local") : createNoopStorage();

export interface PropertyState {
  propertyPreview: any;
}

const initialState: PropertyState = {
  propertyPreview: null,
};

const managePropertySlice = createSlice({
  name: "manageProperty",
  initialState,
  reducers: {
    setPropertyPreview: (state, action: PayloadAction<any>) => {
      state.propertyPreview = action.payload;
    },
  },
});

export const { setPropertyPreview } = managePropertySlice.actions;

// ✅ Correct persist configuration
const persistConfig: PersistConfig<PropertyState> = {
  key: "manageProperty",
  storage,
  whitelist: ["propertyPreview"],
};

export default persistReducer(persistConfig, managePropertySlice.reducer);
