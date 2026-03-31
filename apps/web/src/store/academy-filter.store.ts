import { create } from 'zustand';

interface AcademyFilterState {
  /** academyId seleccionada por SUPER_ADMIN, null = todas */
  selectedAcademyId: string | null;
  setSelectedAcademyId: (id: string | null) => void;
}

export const useAcademyFilterStore = create<AcademyFilterState>()((set) => ({
  selectedAcademyId: null,
  setSelectedAcademyId: (id) => set({ selectedAcademyId: id }),
}));
