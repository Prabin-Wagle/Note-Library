import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Bookmark, ChevronLeft, ChevronRight, AlertTriangle, BookmarkCheck, HelpCircle, CheckCircle2, LogOut, PlayCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, setDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface QuizQuestion {
  id: string;
  questionText: string;
  options: QuizOption[];
  imageLink?: string;
  marks: number;
}

interface Quiz {
  id: string;
  title: string;
  grade: string;
  subject?: string;
  examType?: string;
  timeLimit: number; 
  questions: QuizQuestion[];
}

interface UserAnswer {
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  isBookmarked: boolean;
  marks: number; 
}

interface QuizPlayerProps {
  quiz: Quiz;
  onQuizComplete: (result: QuizResult) => void;
  onExit: () => void;
}

export interface QuizResult {
  quiz: Quiz;
  userAnswers: UserAnswer[];
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpent: number; 
  completedAt: Date;
  totalPossibleMarks: number;
}

const PALETTE_ITEMS_PER_PAGE = 20;

const QuizPlayer: React.FC<QuizPlayerProps> = ({ quiz, onQuizComplete, onExit }) => {
  const { currentUser } = useAuth();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Map<string, string>>(new Map());
  const [timeRemaining, setTimeRemaining] = useState((quiz.timeLimit || 0) * 60);
  const [isQuizStarted, setIsQuizStarted] = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<string>>(new Set());
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [currentPalettePage, setCurrentPalettePage] = useState(0);

  useEffect(() => {
    if (!quiz) {
      console.error("QuizPlayer: Quiz object is null or undefined.");
      return;
    }
    if (!quiz.questions) {
      console.error("QuizPlayer: Quiz questions are missing.");
    }
    if (typeof quiz.timeLimit === 'undefined') {
      console.warn("QuizPlayer: Quiz timeLimit is undefined, defaulting to 0.");
      setTimeRemaining(0);
    } else {
      setTimeRemaining(quiz.timeLimit * 60);
    }
  }, [quiz]);

  const getFilteredQuestions = useCallback(() => {
    if (showBookmarkedOnly) {
      return quiz.questions.filter(q => bookmarkedQuestions.has(q.id));
    }
    return quiz.questions;
  }, [quiz.questions, showBookmarkedOnly, bookmarkedQuestions]);

  const getCurrentQuestion = useCallback(() => {
    if (!quiz || !quiz.questions || !Array.isArray(quiz.questions)) {
      return undefined;
    }
    const filtered = getFilteredQuestions();
    if (currentQuestionIndex >= 0 && currentQuestionIndex < filtered.length) {
      return filtered[currentQuestionIndex];
    }
    return undefined; 
  }, [quiz, currentQuestionIndex, getFilteredQuestions]);

  const currentQuestion = getCurrentQuestion();

  useEffect(() => {
    const filtered = getFilteredQuestions();
    if (currentQuestionIndex >= filtered.length && filtered.length > 0) {
      setCurrentQuestionIndex(filtered.length - 1);
    } else if (filtered.length === 0 && currentQuestionIndex !== 0) {
      setCurrentQuestionIndex(0); 
    }
  }, [showBookmarkedOnly, bookmarkedQuestions, currentQuestionIndex, getFilteredQuestions]);

  const handleStartQuiz = () => {
    setShowStartConfirm(true);
  };

  const confirmStartQuiz = () => {
    setIsQuizStarted(true);
    setStartTime(new Date());
    setShowStartConfirm(false);
    console.log('Quiz started:', quiz.title);
  };

  const renderHtmlContent = (content: string) => {
    const processedContent = content.replace(/\^\(([^)]+)\)/g, '<sup>$1</sup>').replace(/\^(-?[a-zA-Z0-9]+)/g, '<sup>$1</sup>');
    return { __html: processedContent };
  };

  const toggleBookmark = useCallback((questionId: string) => {
    setBookmarkedQuestions(prev => {
      const newBookmarks = new Set(prev);
      if (newBookmarks.has(questionId)) {
        newBookmarks.delete(questionId);
      } else {
        newBookmarks.add(questionId);
      }
      return newBookmarks;
    });
  }, []);

  const getQuestionStatus = useCallback((questionId: string) => {
    const isAnswered = userAnswers.has(questionId);
    const isBookmarked = bookmarkedQuestions.has(questionId);
    return { isAnswered, isBookmarked };
  }, [userAnswers, bookmarkedQuestions]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = useCallback((questionId: string, optionId: string) => {
    setUserAnswers(prev => new Map(prev).set(questionId, optionId));
  }, []);

  const goToNextQuestion = useCallback(() => {
    const filtered = getFilteredQuestions();
    if (currentQuestionIndex < filtered.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  }, [currentQuestionIndex, getFilteredQuestions]);

  const goToPreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  }, [currentQuestionIndex]);

  const goToQuestion = useCallback((index: number) => {
    const filtered = getFilteredQuestions();
    if (index >= 0 && index < filtered.length) {
      setCurrentQuestionIndex(index);
    } else if (filtered.length === 0 && index === 0) {
      setCurrentQuestionIndex(0);
    }
  }, [getFilteredQuestions]);

  const handleSubmitQuiz = useCallback(async () => {
    if (!startTime || !quiz || !quiz.questions || !currentUser) {
      console.error("Cannot submit quiz: missing start time, quiz data, or user.");
      return;
    }
    setShowConfirmSubmit(false);

    const endTime = new Date();
    const timeSpent = Math.floor((endTime.getTime() - (startTime?.getTime() || endTime.getTime())) / 1000);

    const finalUserAnswers: UserAnswer[] = quiz.questions.map((question) => {
      const selectedOptionId = userAnswers.get(question.id) || null;
      let isCorrect: boolean | null = null;
      let marksObtained: number = 0;

      if (selectedOptionId) {
        const selectedOption = question.options.find(opt => opt.id === selectedOptionId);
        isCorrect = selectedOption ? selectedOption.isCorrect : false;
        if (isCorrect) {
          marksObtained = question.marks;
        } else {
          marksObtained = -0.1; 
        }
      }

      return {
        questionId: question.id,
        selectedOptionId,
        isCorrect,
        isBookmarked: bookmarkedQuestions.has(question.id),
        marks: marksObtained,
      };
    });

    const totalPossibleMarks = quiz.questions.reduce((sum, q) => sum + q.marks, 0);
    const score = finalUserAnswers.reduce((total, answer) => total + answer.marks, 0);
    const percentage = totalPossibleMarks > 0 ? Math.round((Math.max(0, score) / totalPossibleMarks) * 100) : 0;

    const resultForCallback: QuizResult = {
      quiz,
      userAnswers: finalUserAnswers,
      score,
      totalQuestions: quiz.questions.length,
      percentage,
      timeSpent,
      completedAt: endTime,
      totalPossibleMarks,
    };

    const firestoreData = {
      userId: currentUser.uid,
      quizId: quiz.id,
      completedAt: Timestamp.fromDate(endTime),
      quizDetails: {
        id: quiz.id,
        title: quiz.title,
        grade: quiz.grade,
        subject: quiz.subject || null,
        examType: quiz.examType || null,
        timeLimit: quiz.timeLimit,
        questions: quiz.questions.map(q => ({
          id: q.id,
          questionText: q.questionText,
          imageLink: q.imageLink || null,
          options: q.options,
          marks: q.marks,
        })),
      },
      userAttempt: {
        answers: finalUserAnswers.map(ua => ({
          questionId: ua.questionId,
          selectedOptionId: ua.selectedOptionId,
          isCorrect: ua.isCorrect,
          isBookmarked: ua.isBookmarked,
          marksObtained: ua.marks,
        })),
        score,
        totalPossibleMarks,
        percentage,
        timeSpent,
        totalQuestions: quiz.questions.length,
      },
    };

    try {
      const quizResultRef = doc(collection(db, "quizResults"));
      await setDoc(quizResultRef, firestoreData);
      console.log("Quiz result saved to Firestore with ID:", quizResultRef.id);
    } catch (error) {
      console.error("Error saving quiz result to Firestore:", error);
    }

    onQuizComplete(resultForCallback);
  }, [quiz, userAnswers, startTime, onQuizComplete, currentUser, bookmarkedQuestions]);

  const handleShowExitConfirm = () => {
    setShowExitConfirm(true);
  };

  const confirmAndExitQuiz = () => {
    setShowExitConfirm(false);
    onExit();
  };

  const handleToggleBookmarkedFilter = useCallback(() => {
    const newFilterState = !showBookmarkedOnly;
    setShowBookmarkedOnly(newFilterState);
  }, [showBookmarkedOnly]);

  useEffect(() => {
    const filtered = getFilteredQuestions();
    const totalPalettePages = Math.ceil(filtered.length / PALETTE_ITEMS_PER_PAGE);
    if (currentPalettePage >= totalPalettePages && totalPalettePages > 0) {
      setCurrentPalettePage(totalPalettePages - 1);
    } else if (filtered.length === 0) {
      setCurrentPalettePage(0);
    }
  }, [getFilteredQuestions, currentPalettePage]);

  useEffect(() => {
    if (!isQuizStarted || timeRemaining <= 0 || isNaN(timeRemaining)) {
      if (isQuizStarted && timeRemaining <= 0) handleSubmitQuiz();
      return;
    }
    const timer = setInterval(() => {
      setTimeRemaining(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isQuizStarted, timeRemaining, handleSubmitQuiz]);

  useEffect(() => {
    if (!isQuizStarted) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      if (showStartConfirm || showConfirmSubmit || showExitConfirm) return;

      if (event.key === 'ArrowRight') goToNextQuestion();
      if (event.key === 'ArrowLeft') goToPreviousQuestion();
      if (event.key === 'b' && currentQuestion) toggleBookmark(currentQuestion.id);
      
      if (currentQuestion && currentQuestion.options.length >= parseInt(event.key) && parseInt(event.key) >= 1 && parseInt(event.key) <= 9) {
        const optionIndex = parseInt(event.key) - 1;
        if (currentQuestion.options[optionIndex]) {
          handleAnswerSelect(currentQuestion.id, currentQuestion.options[optionIndex].id);
        }
      }
    };
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isQuizStarted, currentQuestion, showStartConfirm, showConfirmSubmit, showExitConfirm, bookmarkedQuestions, goToNextQuestion, goToPreviousQuestion, toggleBookmark, handleAnswerSelect]);

  const getAnsweredCount = useCallback(() => {
    return userAnswers.size;
  }, [userAnswers]);

  if (!quiz || !quiz.questions) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center p-8 bg-white shadow-xl rounded-lg">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-2xl font-semibold text-gray-700">Quiz Data Error</h2>
          <p className="mt-2 text-gray-500">There was a problem loading the quiz. Please try again later.</p>
          <button
            onClick={onExit} 
            className="mt-6 px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!isQuizStarted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-blue-500 to-purple-600 text-white p-4">
        <div className="bg-white text-gray-800 p-8 rounded-xl shadow-2xl text-center max-w-md w-full">
          <HelpCircle size={48} className="mx-auto mb-4 text-blue-500" />
          <h1 className="text-3xl font-bold mb-2">{quiz.title}</h1>
          <p className="text-lg text-gray-600 mb-1">Grade: {quiz.grade}</p>
          {quiz.subject && <p className="text-md text-gray-500 mb-1">Subject: {quiz.subject}</p>}
          {quiz.examType && <p className="text-md text-gray-500 mb-1">Exam Type: {quiz.examType}</p>}
          <p className="text-md text-gray-500 mb-6">Time Limit: {quiz.timeLimit} minutes</p>
          <button
            onClick={handleStartQuiz}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 flex items-center justify-center"
          >
            <PlayCircle size={20} className="mr-2" />
            Start Quiz
          </button>
        </div>

        {showStartConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Confirm Start</h3>
              <p className="text-gray-600 mb-6">Are you sure you want to start the quiz "{quiz.title}"?</p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowStartConfirm(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStartQuiz}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                >
                  Start
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const filteredQuestions = getFilteredQuestions();
  const currentVisibleQuestion = currentQuestion; 

  const questionDisplayContent = currentVisibleQuestion?.questionText || (currentVisibleQuestion?.imageLink ? "" : (filteredQuestions.length > 0 ? `Question ${filteredQuestions.findIndex(q => q.id === currentVisibleQuestion?.id) + 1} content is missing.` : "No questions to display."));


  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 font-sans">
      {/* Question Area */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto">
        {currentVisibleQuestion ? (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl md:text-2xl font-semibold text-gray-700">
                Question {filteredQuestions.findIndex(q => q.id === currentVisibleQuestion.id) + 1} of {filteredQuestions.length}
              </h2>
              <button onClick={() => toggleBookmark(currentVisibleQuestion.id)} title="Toggle Bookmark" className={`p-2 rounded-full ${bookmarkedQuestions.has(currentVisibleQuestion.id) ? 'bg-blue-100 text-blue-500' : 'hover:bg-gray-200'}`}>
                {bookmarkedQuestions.has(currentVisibleQuestion.id) ? <BookmarkCheck size={24} /> : <Bookmark size={24} />}
              </button>
            </div>

            {currentVisibleQuestion.imageLink && (
              <img 
                src={currentVisibleQuestion.imageLink} 
                alt={`Question ${filteredQuestions.findIndex(q => q.id === currentVisibleQuestion.id) + 1}`} 
                className="max-w-full h-auto my-4 rounded-md border border-gray-200" 
              />
            )}
            
            {questionDisplayContent && (
              <div 
                className="prose max-w-none text-gray-800 mb-6" 
                dangerouslySetInnerHTML={renderHtmlContent(questionDisplayContent)} 
              />
            )}

            <div className="space-y-3">
              {currentVisibleQuestion.options.map((option, index) => (
                <button
                  key={option.id}
                  onClick={() => handleAnswerSelect(currentVisibleQuestion.id, option.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-150
                    ${userAnswers.get(currentVisibleQuestion.id) === option.id 
                      ? 'bg-blue-500 border-blue-600 text-white shadow-md ring-2 ring-blue-300' 
                      : 'bg-gray-50 hover:bg-gray-100 border-gray-300 hover:border-blue-400 text-gray-700'}`}
                >
                  <span className="font-medium mr-2">{String.fromCharCode(65 + index)}.</span> {option.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-white p-6 rounded-lg shadow-lg">
            <HelpCircle size={48} className="text-gray-400 mb-4" />
            <p className="text-xl text-gray-600">
              {showBookmarkedOnly ? "No bookmarked questions." : "No questions available."}
            </p>
            {showBookmarkedOnly && (
                 <button 
                    onClick={handleToggleBookmarkedFilter}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                 >
                    Show All Questions
                 </button>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={goToPreviousQuestion}
            disabled={currentQuestionIndex === 0 && filteredQuestions.indexOf(currentVisibleQuestion!) === 0}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors flex items-center"
          >
            <ChevronLeft size={20} className="mr-1" /> Previous
          </button>
          <button
            onClick={goToNextQuestion}
            disabled={currentQuestionIndex >= filteredQuestions.length - 1 && filteredQuestions.indexOf(currentVisibleQuestion!) === filteredQuestions.length -1}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center"
          >
            Next <ChevronRight size={20} className="ml-1" />
          </button>
        </div>
      </div> {/* Closing tag for Question Area div */}

      {/* Right Sidebar (Timer, Palette, Submit) */}
      <div className="w-full md:w-80 lg:w-96 bg-white p-4 md:p-6 shadow-lg md:border-l border-gray-200 flex flex-col">
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-700">Quiz Overview</h3>
          <div className="flex items-center text-red-500 font-semibold bg-red-100 px-3 py-1 rounded-full">
            <Clock size={18} className="mr-2" />
            <span>{formatTime(timeRemaining)}</span>
          </div>
        </div>
        
        <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
                 <p className="text-sm text-gray-600">
                    Answered: {getAnsweredCount()} / {quiz.questions.length} | Bookmarked: {bookmarkedQuestions.size}
                 </p>
            </div>
            <label className="flex items-center space-x-2 cursor-pointer text-sm text-gray-700 mb-3">
              <input
                type="checkbox"
                checked={showBookmarkedOnly}
                onChange={handleToggleBookmarkedFilter}
                className="form-checkbox h-4 w-4 text-blue-500 rounded border-gray-300 focus:ring-blue-400"
              />
              <span>Show Bookmarked Only</span>
            </label>

            {filteredQuestions.length > PALETTE_ITEMS_PER_PAGE && (
              <div className="flex justify-between items-center mb-3 px-1">
                <button
                  onClick={() => setCurrentPalettePage(p => Math.max(0, p - 1))}
                  disabled={currentPalettePage === 0}
                  className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page of questions"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-xs text-gray-600">
                  Page {currentPalettePage + 1} of {Math.ceil(filteredQuestions.length / PALETTE_ITEMS_PER_PAGE) || 1}
                </span>
                <button
                  onClick={() => setCurrentPalettePage(p => Math.min(Math.ceil(filteredQuestions.length / PALETTE_ITEMS_PER_PAGE) - 1, p + 1))}
                  disabled={currentPalettePage >= Math.ceil(filteredQuestions.length / PALETTE_ITEMS_PER_PAGE) - 1 || filteredQuestions.length === 0}
                  className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next page of questions"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
        </div>

        <div className="grid grid-cols-5 gap-2 mb-auto overflow-y-auto" style={{maxHeight: 'calc(100vh - 350px)'}}>
          {filteredQuestions
            .slice(currentPalettePage * PALETTE_ITEMS_PER_PAGE, (currentPalettePage + 1) * PALETTE_ITEMS_PER_PAGE)
            .map((q) => {
              const actualIndex = quiz.questions.findIndex(origQ => origQ.id === q.id);
              const { isAnswered, isBookmarked } = getQuestionStatus(q.id);
              const isCurrent = currentVisibleQuestion?.id === q.id;
              return (
                <button
                  key={q.id}
                  onClick={() => goToQuestion(filteredQuestions.findIndex(fq => fq.id === q.id))}
                  title={`Question ${actualIndex + 1}${isAnswered ? ' (Answered)' : ''}${isBookmarked ? ' (Bookmarked)' : ''}`}
                  className={`p-2 rounded-md text-sm font-medium border-2 transition-all duration-150 flex items-center justify-center aspect-square
                    ${isCurrent ? 'bg-blue-500 border-blue-600 text-white ring-2 ring-blue-300' : 
                     isAnswered ? 'bg-green-100 border-green-400 text-green-700 hover:bg-green-200' : 
                     'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'}
                    ${isBookmarked ? (isCurrent ? 'ring-offset-1 ring-offset-yellow-300' : 'border-yellow-400') : ''}
                  `}
                >
                  {isBookmarked && <Bookmark size={12} className={`absolute top-1 right-1 ${isCurrent ? 'text-white': 'text-yellow-500'}`} />}
                  {actualIndex + 1}
                </button>
              );
          })}
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
          <button
            onClick={() => setShowConfirmSubmit(true)}
            className="w-full py-3 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold transition-colors flex items-center justify-center"
          >
            <CheckCircle2 size={20} className="mr-2"/> Submit Quiz
          </button>
          <button
            onClick={handleShowExitConfirm} 
            className="w-full py-3 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold transition-colors flex items-center justify-center"
          >
            <LogOut size={20} className="mr-2"/> Exit Quiz
          </button>
        </div>
      </div> {/* Closing tag for Right Sidebar div */}

      {/* Submit Confirmation Dialog */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl max-w-md w-full text-center">
            <AlertTriangle className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
            <h3 className="text-2xl font-semibold mb-3 text-gray-800">Confirm Submission</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to submit your answers? You have answered {getAnsweredCount()} out of {quiz.questions.length} questions.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="px-6 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitQuiz}
                className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors font-medium"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl max-w-md w-full">
            <AlertTriangle className="mx-auto h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-2xl font-semibold mb-3 text-gray-800">Confirm Exit</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to exit the quiz? Your progress will be lost.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="px-6 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndExitQuiz}
                className="px-6 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-medium"
              >
                Exit Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizPlayer;