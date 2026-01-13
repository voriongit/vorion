'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  Clock,
  RotateCcw,
  Trophy,
  AlertCircle,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import type { Quiz as QuizType, QuizQuestion, QuizAttempt } from '@/types';

interface QuizProps {
  quiz: QuizType;
  onComplete?: (attempt: QuizAttempt) => void;
  onRetry?: () => void;
}

type QuizState = 'intro' | 'active' | 'review' | 'results';

export function Quiz({ quiz, onComplete, onRetry }: QuizProps) {
  const [state, setState] = useState<QuizState>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(quiz.timeLimit ? quiz.timeLimit * 60 : 0);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);

  const currentQuestion = quiz.questions[currentIndex];
  const totalQuestions = quiz.questions.length;
  const hasTimeLimit = quiz.timeLimit && quiz.timeLimit > 0;

  // Timer effect
  useEffect(() => {
    if (state !== 'active' || !hasTimeLimit) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          finishQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state, hasTimeLimit]);

  const startQuiz = () => {
    setStartTime(Date.now());
    setTimeLeft(quiz.timeLimit ? quiz.timeLimit * 60 : 0);
    setState('active');
  };

  const selectAnswer = (optionId: string) => {
    if (showExplanation) return;
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: optionId }));
    setShowExplanation(true);
  };

  const nextQuestion = () => {
    setShowExplanation(false);
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = useCallback(() => {
    const score = calculateScore();
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    const newAttempt: QuizAttempt = {
      quizId: quiz.id,
      answers,
      score,
      passed: score >= quiz.passingScore,
      completedAt: new Date(),
      timeSpent,
    };

    setAttempt(newAttempt);
    setState('results');
    onComplete?.(newAttempt);
  }, [answers, quiz.id, quiz.passingScore, startTime, onComplete]);

  const calculateScore = (): number => {
    let correct = 0;
    for (const question of quiz.questions) {
      const selectedId = answers[question.id];
      const correctOption = question.options.find(o => o.isCorrect);
      if (selectedId === correctOption?.id) {
        correct++;
      }
    }
    return Math.round((correct / totalQuestions) * 100);
  };

  const isCorrectAnswer = (questionId: string): boolean => {
    const question = quiz.questions.find(q => q.id === questionId);
    if (!question) return false;
    const selectedId = answers[questionId];
    const correctOption = question.options.find(o => o.isCorrect);
    return selectedId === correctOption?.id;
  };

  const getSelectedOption = (question: QuizQuestion) => {
    return question.options.find(o => o.id === answers[question.id]);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRetry = () => {
    setAnswers({});
    setCurrentIndex(0);
    setShowExplanation(false);
    setAttempt(null);
    setState('intro');
    onRetry?.();
  };

  // Intro Screen
  if (state === 'intro') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-cyan-400" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">{quiz.title}</h2>
          <p className="text-gray-400 mb-6">{quiz.description}</p>

          <div className="flex justify-center gap-6 mb-8 text-sm">
            <div className="text-gray-400">
              <span className="text-white font-medium">{totalQuestions}</span> questions
            </div>
            <div className="text-gray-400">
              <span className="text-white font-medium">{quiz.passingScore}%</span> to pass
            </div>
            {hasTimeLimit && (
              <div className="text-gray-400">
                <span className="text-white font-medium">{quiz.timeLimit}</span> min limit
              </div>
            )}
          </div>

          <button
            onClick={startQuiz}
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg transition-colors inline-flex items-center gap-2"
          >
            Start Quiz
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Results Screen
  if (state === 'results' && attempt) {
    const passed = attempt.passed;

    return (
      <div className="max-w-2xl mx-auto">
        <div className={`border rounded-xl p-8 text-center ${
          passed
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${
            passed ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            {passed ? (
              <Trophy className="w-10 h-10 text-green-400" />
            ) : (
              <AlertCircle className="w-10 h-10 text-red-400" />
            )}
          </div>

          <h2 className={`text-2xl font-bold mb-2 ${passed ? 'text-green-400' : 'text-red-400'}`}>
            {passed ? 'Congratulations!' : 'Keep Learning!'}
          </h2>

          <p className="text-gray-400 mb-6">
            {passed
              ? 'You\'ve demonstrated solid understanding of the material.'
              : `You need ${quiz.passingScore}% to pass. Review the material and try again.`
            }
          </p>

          <div className="text-5xl font-bold text-white mb-2">
            {attempt.score}%
          </div>
          <p className="text-sm text-gray-500 mb-6">
            {quiz.questions.filter(q => isCorrectAnswer(q.id)).length} of {totalQuestions} correct
          </p>

          <div className="flex items-center justify-center gap-4 text-sm text-gray-400 mb-8">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatTime(attempt.timeSpent)}
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => setState('review')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Review Answers
            </button>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Review Screen
  if (state === 'review') {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Review Your Answers</h2>
          <button
            onClick={() => setState('results')}
            className="text-sm text-gray-400 hover:text-cyan-400 transition-colors"
          >
            Back to Results
          </button>
        </div>

        {quiz.questions.map((question, index) => {
          const correct = isCorrectAnswer(question.id);
          const selectedOption = getSelectedOption(question);
          const correctOption = question.options.find(o => o.isCorrect);

          return (
            <div
              key={question.id}
              className={`border rounded-xl p-6 ${
                correct
                  ? 'bg-green-500/5 border-green-500/30'
                  : 'bg-red-500/5 border-red-500/30'
              }`}
            >
              <div className="flex items-start gap-3 mb-4">
                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                  correct ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="text-white font-medium">{question.question}</p>
                  <p className="text-xs text-gray-500 mt-1">Term: {question.termName}</p>
                </div>
                {correct ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                )}
              </div>

              <div className="space-y-2 mb-4">
                {question.options.map(option => {
                  const isSelected = option.id === selectedOption?.id;
                  const isCorrect = option.isCorrect;

                  let className = 'p-3 rounded-lg border text-sm ';
                  if (isCorrect) {
                    className += 'bg-green-500/10 border-green-500/50 text-green-300';
                  } else if (isSelected && !isCorrect) {
                    className += 'bg-red-500/10 border-red-500/50 text-red-300';
                  } else {
                    className += 'bg-gray-800/30 border-gray-700/50 text-gray-400';
                  }

                  return (
                    <div key={option.id} className={className}>
                      <div className="flex items-center gap-2">
                        {isCorrect && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                        {isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-400" />}
                        <span>{option.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-gray-800/30 rounded-lg p-3 text-sm text-gray-400">
                <span className="font-medium text-gray-300">Explanation: </span>
                {question.explanation}
              </div>
            </div>
          );
        })}

        <div className="flex justify-center pt-4">
          <button
            onClick={handleRetry}
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Active Quiz Screen
  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-400">
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          {hasTimeLimit && (
            <span className={`flex items-center gap-1 ${timeLeft < 60 ? 'text-red-400' : 'text-gray-400'}`}>
              <Clock className="w-4 h-4" />
              {formatTime(timeLeft)}
            </span>
          )}
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-500 transition-all duration-300"
            style={{ width: `${((currentIndex + (showExplanation ? 1 : 0)) / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="mb-6">
          <span className="text-xs text-cyan-400 font-medium uppercase tracking-wider">
            {currentQuestion.termName}
          </span>
          <h3 className="text-xl font-medium text-white mt-2">
            {currentQuestion.question}
          </h3>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.options.map(option => {
            const isSelected = answers[currentQuestion.id] === option.id;
            const showResult = showExplanation;
            const isCorrect = option.isCorrect;

            let className = 'w-full p-4 rounded-lg border text-left transition-all ';

            if (showResult) {
              if (isCorrect) {
                className += 'bg-green-500/10 border-green-500/50 text-green-300';
              } else if (isSelected && !isCorrect) {
                className += 'bg-red-500/10 border-red-500/50 text-red-300';
              } else {
                className += 'bg-gray-800/30 border-gray-700/50 text-gray-400';
              }
            } else {
              if (isSelected) {
                className += 'bg-cyan-500/10 border-cyan-500/50 text-white';
              } else {
                className += 'bg-gray-800/30 border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-gray-800/50';
              }
            }

            return (
              <button
                key={option.id}
                onClick={() => selectAnswer(option.id)}
                disabled={showExplanation}
                className={className}
              >
                <div className="flex items-center gap-3">
                  {showResult && isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  )}
                  {showResult && isSelected && !isCorrect && (
                    <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                  )}
                  <span>{option.text}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showExplanation && (
          <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <p className="text-sm text-gray-300">
              <span className="font-medium text-white">Explanation: </span>
              {currentQuestion.explanation}
            </p>
            <Link
              href={`/lexicon?term=${encodeURIComponent(currentQuestion.termName)}`}
              className="inline-flex items-center gap-1 mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Learn more about {currentQuestion.termName}
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Next Button */}
        {showExplanation && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={nextQuestion}
              className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg transition-colors inline-flex items-center gap-2"
            >
              {currentIndex < totalQuestions - 1 ? 'Next Question' : 'See Results'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
