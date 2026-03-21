function BudgetBreakdownSimple({ mode, income, expenses, allocation, onAlert }) {
  try {
    const safeIncome   = parseFloat(income)  || 0;
    const safeExpenses = Array.isArray(expenses) ? expenses : [];

    const safeAllocation = allocation
      ? {
          needs:         allocation.needs         ?? 0,
          wants:         allocation.wants         ?? 0,
          others:        allocation.others        ?? 0,
          savings:       allocation.savings       ?? 0,
          needsAmount:   allocation.needsAmount   ?? (allocation.needs   / 100) * safeIncome,
          wantsAmount:   allocation.wantsAmount   ?? (allocation.wants   / 100) * safeIncome,
          othersAmount:  allocation.othersAmount  ?? (allocation.others  / 100) * safeIncome,
          savingsAmount: allocation.savingsAmount ?? (allocation.savings / 100) * safeIncome,
        }
      : null;

    let baseBreakdown;
    let balancedBreakdown;

    try {
      baseBreakdown = safeAllocation
        ? calculateBudgetWithAllocation(safeIncome, safeAllocation)
        : calculateBudget(mode, safeIncome);
    } catch (e) {
      console.error('calculateBudget error:', e);
      baseBreakdown = safeAllocation
        ? {
            needs:   safeAllocation.needsAmount,
            wants:   safeAllocation.wantsAmount,
            others:  safeAllocation.othersAmount,
            savings: safeAllocation.savingsAmount,
          }
        : { needs: 0, wants: 0, others: 0, savings: 0 };
    }

    try {
      balancedBreakdown = safeAllocation
        ? calculateBalancedBudgetWithAllocation(safeIncome, safeAllocation, safeExpenses)
        : calculateBalancedBudget(mode, safeIncome, safeExpenses);
    } catch (e) {
      console.error('calculateBalancedBudget error:', e);
      balancedBreakdown = baseBreakdown;
    }

    const getCategorySpent = (category) =>
      safeExpenses
        .filter(exp => exp.category === category)
        .reduce((sum, exp) => {
          const amt = parseFloat(exp.amount);
          return sum + (isNaN(amt) || amt < 0 ? 0 : amt);
        }, 0);

    const PRIMARY   = '#e63946'; // app primary red — used for all icons and bars
    const OVERSPEND = '#c1121f'; // darker red for overspent state

    const categoryIcons = {
      'Needs':   'briefcase',
      'Wants':   'heart',
      'Others':  'grid-3x3',
      'Savings': 'piggy-bank',
    };

    const categoryExamples = {
      'Needs':   'Rent, Transport, Bills, Groceries, Healthcare',
      'Wants':   'Dining Out, Entertainment, Subscriptions, Movies',
      'Others':  'Shopping, Personal Care, Miscellaneous, Gifts',
      'Savings': 'Emergency Fund, Investments, Long-term Goals',
    };

    const totalBudget = safeIncome;
    const totalSpent  = safeExpenses.reduce((sum, exp) => {
      const amt = parseFloat(exp.amount);
      return sum + (isNaN(amt) || amt < 0 ? 0 : amt);
    }, 0);
    const totalRemaining  = Math.max(totalBudget - totalSpent, 0);
    const totalPercentage = totalBudget > 0
      ? Math.min((totalSpent / totalBudget) * 100, 100)
      : 0;
    const isOverBudget = totalSpent > totalBudget;

    const renderCategory = (label, key) => {
      const amount     = (balancedBreakdown && balancedBreakdown[key]) || 0;
      const spent      = getCategorySpent(label);
      const overspent  = spent > amount;
      const percentage = amount > 0 ? (spent / amount) * 100 : 0;
      const remaining  = amount - spent;
      const allocPct   = safeAllocation ? (safeAllocation[key] ?? 0) : 0;

      return (
        <div
          key={label}
          className={`bg-white rounded-xl p-4 shadow-md border-l-4 transition-all ${
            overspent ? 'border-red-400' : 'border-transparent hover:border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {/* Icon — always primary red */}
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: PRIMARY }}
              >
                <div className={`icon-${categoryIcons[label]} text-xl text-white`}></div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-gray-800">{label}</div>
                  {allocPct > 0 && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      {allocPct}%
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 truncate max-w-[160px]">
                  {categoryExamples[label]}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  Budget: {formatCurrency(amount)}
                </div>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <div className="font-bold" style={{ color: overspent ? OVERSPEND : PRIMARY }}>
                {formatCurrency(spent)}
              </div>
              <div className="text-xs text-gray-500">
                {Math.min(percentage, 100).toFixed(0)}% used
              </div>
            </div>
          </div>

          {/* Progress bar — primary red, darker when overspent */}
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width:           `${Math.min(percentage, 100)}%`,
                backgroundColor: overspent ? OVERSPEND : PRIMARY,
              }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {overspent ? 'Overspent:' : 'Remaining:'}
            </span>
            <span
              className="font-semibold flex items-center gap-1"
              style={{ color: overspent ? OVERSPEND : PRIMARY }}
            >
              {overspent && <div className="icon-circle-alert text-xs"></div>}
              {overspent
                ? `${formatCurrency(Math.abs(remaining))} over`
                : formatCurrency(remaining)
              }
            </span>
          </div>

          {percentage >= 90 && percentage < 100 && (
            <div className="mt-2 text-xs bg-red-50 rounded-lg px-2 py-1 flex items-center gap-1"
                 style={{ color: PRIMARY }}>
              <div className="icon-triangle-alert text-xs"></div>
              <span>Almost at budget limit</span>
            </div>
          )}
          {overspent && (
            <div className="mt-2 text-xs bg-red-50 rounded-lg px-2 py-1 flex items-center gap-1"
                 style={{ color: OVERSPEND }}>
              <div className="icon-circle-alert text-xs"></div>
              <span>Over budget for this category</span>
            </div>
          )}
        </div>
      );
    };

    return (
      <div
        className="space-y-4"
        data-name="budget-breakdown-simple"
        data-file="components/BudgetBreakdownSimple.js"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Budget Breakdown</h2>
          <div className="text-right">
            <div className="text-sm text-gray-500">Total Income</div>
            <div className="text-2xl font-bold" style={{ color: PRIMARY }}>
              {formatCurrency(safeIncome)}
            </div>
          </div>
        </div>

        {/* Overall spending bar — primary red */}
        <div className={`rounded-xl p-4 ${isOverBudget ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-medium text-gray-700">Overall Spending</span>
            <span className="font-semibold text-gray-700">
              {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width:           `${Math.min(totalPercentage, 100)}%`,
                backgroundColor: isOverBudget ? OVERSPEND : PRIMARY,
              }}
            ></div>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>{totalPercentage.toFixed(0)}% of budget used</span>
            <span className="font-medium" style={{ color: isOverBudget ? OVERSPEND : PRIMARY }}>
              {isOverBudget
                ? `${formatCurrency(totalSpent - totalBudget)} over budget`
                : `${formatCurrency(totalRemaining)} remaining`
              }
            </span>
          </div>
        </div>

        {/* Category cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {renderCategory('Needs',   'needs')}
          {renderCategory('Wants',   'wants')}
          {renderCategory('Others',  'others')}
          {renderCategory('Savings', 'savings')}
        </div>
      </div>
    );
  } catch (error) {
    console.error('BudgetBreakdownSimple component error:', error);
    return null;
  }
}
