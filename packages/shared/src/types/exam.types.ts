export interface ExamQuestionAnswer {
  id: string;
  text: string;
  isCorrect?: boolean; // solo presente tras submit
}

export interface ExamQuestionPublic {
  id: string;
  text: string;
  type: 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE';
  answers: ExamQuestionAnswer[];
}

export interface ExamAttemptStarted {
  attemptId: string;
  questions: ExamQuestionPublic[]; // sin isCorrect
  numQuestions: number;
  timeLimit: number | null;
  onlyOnce: boolean;
  startedAt: string;
}

export interface ExamCorrection {
  questionId: string;
  questionText: string;
  selectedAnswerId: string | null;
  selectedAnswerText: string | null;
  correctAnswerId: string;
  correctAnswerText: string;
  isCorrect: boolean;
}

export interface ExamAttemptResult {
  attemptId: string;
  score: number;
  numQuestions: number;
  correctCount: number;
  submittedAt: string;
  corrections: ExamCorrection[];
}

export interface ExamBankInfo {
  questionCount: number;
  scope: 'course' | 'module';
  scopeId: string;
  scopeTitle: string;
  recentAttempts: {
    attemptId: string;
    score: number;
    numQuestions: number;
    submittedAt: string;
  }[];
}
