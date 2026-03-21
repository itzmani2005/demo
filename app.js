class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-4">We're sorry, but something unexpected happened.</p>
            <button onClick={() => window.location.reload()} className="btn-primary">
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  try {
    const [mode, setMode] = React.useState(null);
    const [currentMonth, setCurrentMonth] = React.useState(null);
    const [income, setIncome] = React.useState(0);
    const [allocation, setAllocation] = React.useState(null);
    const [expenses, setExpenses] = React.useState([]);
    const [goals, setGoals] = React.useState([]);
    const [alert, setAlert] = React.useState(null);
    const [currentSection, setCurrentSection] = React.useState('home');
    const [loading, setLoading] = React.useState(false);

    const loadMonthDataFromFirestore = React.useCallback(async () => {
      setLoading(true);
      try {
        const monthData = await loadMonthFromFirestore(currentMonth, mode);
        // FIX 2 — only reset state when there is genuinely no cloud data at all.
        // Previously this wiped goals/expenses whenever income happened to be 0.
        if (monthData) {
          setIncome(monthData.income || 0);
          setAllocation(monthData.allocation || null);
          setExpenses(monthData.expenses || []);
          setGoals(monthData.goals || []);
        } else {
          // No cloud document yet — start fresh for this month
          setIncome(0);
          setAllocation(null);
          setExpenses([]);
          setGoals([]);
        }
      } catch (error) {
        console.error('Error loading month data:', error);
      }
      setLoading(false);
    }, [currentMonth, mode]); // only re-create when month or mode changes

   
    React.useEffect(() => {
      if (currentMonth && mode && window.currentUser) {
        loadMonthDataFromFirestore();
      }
    }, [currentMonth, mode, loadMonthDataFromFirestore]);

    const isReadyToAutoSave =
      !loading &&
      mode &&
      currentMonth &&
      income > 0 &&
      allocation &&
      window.currentUser;

    React.useEffect(() => {
      if (!isReadyToAutoSave) return;
      saveMonthToFirestore(mode, currentMonth, income, allocation, expenses, goals)
        .catch(err => console.error('Auto-save failed:', err));
    }, [expenses, goals]);
    const showAlert = (message, type = 'warning') => {
      setAlert({ message, type });
      setTimeout(() => setAlert(null), 5000);
    };

    const handleNavigate = (sectionId) => {
      setCurrentSection(sectionId);
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    const handleAddSavingExpense = async (amount, goalName) => {
      const newExpense = {
        id: Date.now(),
        name: `Savings for ${goalName}`,
        category: 'Savings',
        amount: parseFloat(amount),
        date: new Date().toISOString()
      };
      const updatedExpenses = [newExpense, ...expenses];
      setExpenses(updatedExpenses);
  
      saveToStorage({ mode, currentMonth, income, expenses: updatedExpenses, goals });
   
      if (window.currentUser) {
        try {
          await saveMonthToFirestore(mode, currentMonth, income, allocation, updatedExpenses, goals);
        } catch (err) {
          console.error('Failed to sync saving expense to Firestore:', err);
        }
      }
    };

    const handleManualSave = async () => {
      if (income > 0 && window.currentUser) {
        try {
          await saveMonthToFirestore(mode, currentMonth, income, allocation, expenses, goals);
          showAlert('All data saved successfully!', 'success');
        } catch (error) {
          console.error('Save error:', error);
          showAlert('Failed to save data', 'danger');
        }
      } else if (!window.currentUser) {
        showAlert('Please sign in to save your data to the cloud.', 'warning');
      }
    };

    const handleGoToHome = async () => {
      if (income > 0) {
        saveToStorage({ mode, currentMonth, income, expenses, goals });
        // FIX 4 — cloud save on navigate home
        if (window.currentUser) {
          try {
            await saveMonthToFirestore(mode, currentMonth, income, allocation, expenses, goals);
          } catch (err) {
            console.error('Failed to save to Firestore on home navigation:', err);
          }
        }
      }
      setMode(null);
      setCurrentMonth(null);
      setCurrentSection('home');
    };

    const handleChangeMode = () => {
      setMode(null);
      setCurrentSection('home');
    };

    const handleChangeMonth = () => {
      setCurrentMonth(null);
      setCurrentSection('home');
    };

    if (!mode) {
      return <ModeSelector onSelectMode={setMode} />;
    }

    if (mode === 'expected') {
      return <ExpectedBudget onBack={() => setMode(null)} />;
    }

    if (!currentMonth) {
      return <MonthSelector onSelectMonth={setCurrentMonth} onBack={() => setMode(null)} mode={mode} />;
    }

    if (income === 0) {
      return <IncomeInput mode={mode} onSetIncome={setIncome} onBack={() => setCurrentMonth(null)} />;
    }
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="icon-loader animate-spin text-5xl text-[var(--primary-color)] mb-4"></div>
            <p className="text-gray-600">Loading your data...</p>
          </div>
        </div>
      );
    }

    if (!allocation) {
      return <AllocationSelector mode={mode} income={income} onSetAllocation={setAllocation} onBack={() => setIncome(0)} />;
    }

    return (
      <div className="min-h-screen bg-gray-50" data-name="app" data-file="app.js">
        {alert && <Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}
        
        <Navbar currentSection={currentSection} onNavigate={handleNavigate} />
        
        <div className="bg-white shadow-sm py-3 sticky top-16 z-40">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">{currentMonth}</span> • <span className="capitalize">{mode} Mode</span>
            </p>
            <div className="flex items-center gap-3">
              <button onClick={handleChangeMonth} className="text-sm text-gray-600 hover:text-[var(--primary-color)] font-medium">
                Change Month
              </button>
              <button onClick={handleChangeMode} className="text-sm text-gray-600 hover:text-[var(--primary-color)] font-medium">
                Change Mode
              </button>
            </div>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 py-6 space-y-8 animate-fade-in pb-20">
          <div id="budget">
            <BudgetBreakdownSimple mode={mode} income={income} expenses={expenses} allocation={allocation} onAlert={showAlert} />
          </div>
          <div id="expenses">
            <ExpenseTracker expenses={expenses} setExpenses={setExpenses} />
          </div>
          <div id="goals">
            <GoalTracker goals={goals} setGoals={setGoals} onAddSavingExpense={handleAddSavingExpense} />
          </div>
          <div id="summary">
            <Summary mode={mode} income={income} expenses={expenses} goals={goals} allocation={allocation} />
          </div>
          <div id="insights">
            <SmartInsights mode={mode} income={income} expenses={expenses} allocation={allocation} onAlert={showAlert} />
          </div>
          <BudgetChart mode={mode} income={income} expenses={expenses} allocation={allocation} />
          <MonthlyOverview expenses={expenses} />
          
          <div className="card text-center">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={handleManualSave} className="btn-primary">
                <div className="flex items-center gap-2">
                  <div className="icon-save text-xl"></div>
                  <span>Save All Changes</span>
                </div>
              </button>
              <button onClick={handleGoToHome} className="btn-secondary">
                <div className="flex items-center gap-2">
                  <div className="icon-home text-xl"></div>
                  <span>Back to Home</span>
                </div>
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-3">Save your data or return to the top of the page</p>
          </div>
        </main>
      </div>
    );
  } catch (error) {
    console.error('App component error:', error);
    return null;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);