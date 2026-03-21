function MonthSelector({ onSelectMonth, onBack, mode }) {
  try {
    const [customMonth, setCustomMonth]   = React.useState('');
    const [showCustom, setShowCustom]     = React.useState(false);
    const [savedMonths, setSavedMonths]   = React.useState([]);
    const [loading, setLoading]           = React.useState(true);
    const [deleteModal, setDeleteModal]   = React.useState({ isOpen: false, month: '' });
    const [editModal, setEditModal]       = React.useState({ isOpen: false, month: '' });
    const [editValue, setEditValue]       = React.useState('');
    const [editError, setEditError]       = React.useState('');
    const [error, setError]               = React.useState('');
    const [customError, setCustomError]   = React.useState('');

    React.useEffect(() => {
      if (mode && window.currentUser) {
        loadMonthsList();
      } else if (mode && !window.currentUser) {
        const timer = setTimeout(() => {
          if (window.currentUser) loadMonthsList();
          else setLoading(false);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }, [mode]);

    const loadMonthsList = async () => {
      setLoading(true);
      setError('');
      try {
        const [firestoreMonths, localMonths] = await Promise.all([
          getAllMonthsFromFirestore().catch(() => []),
          Promise.resolve(getAllMonths(mode)),
        ]);
        const merged = [...new Set([...firestoreMonths, ...localMonths])];

        const sorted = merged.sort((a, b) => {
          const parse = (str) => {
            const [month, year] = str.split(' ');
            const months = ['January','February','March','April','May','June',
                            'July','August','September','October','November','December'];
            return new Date(parseInt(year), months.indexOf(month));
          };
          return parse(b) - parse(a);
        });

        setSavedMonths(sorted);
      } catch (err) {
        console.error('Error loading months:', err);
        setError('Could not load saved months. Showing local data only.');
        setSavedMonths(getAllMonths(mode));
      } finally {
        setLoading(false);
      }
    };

    const getCurrentMonth = () => {
      const date   = new Date();
      const months = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
      return `${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    const VALID_MONTHS = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December'];

    const validateMonthStr = (value) => {
      const trimmed = value.trim();
      if (!trimmed) return 'Please enter a month name.';
      const parts = trimmed.split(' ');
      if (parts.length !== 2) return 'Format must be "Month Year" e.g. December 2025';
      const [monthName, year] = parts;
      if (!VALID_MONTHS.includes(monthName))
        return `"${monthName}" is not a valid month name.`;
      const yearNum = parseInt(year);
      if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100)
        return 'Please enter a valid year between 2000 and 2100.';
      return null;
    };

    const normaliseMonth = (value) => {
      const [m, y] = value.trim().split(' ');
      return `${m.charAt(0).toUpperCase()}${m.slice(1).toLowerCase()} ${y}`;
    };

    const handleSelect = (month) => onSelectMonth(month);

    // ── Delete ────────────────────────────────────────────────────────────────
    const handleDeleteClick = (month, e) => {
      e.stopPropagation();
      setDeleteModal({ isOpen: true, month });
    };

    const handleDeleteConfirm = async () => {
      try {
        await Promise.all([
          deleteMonthFromFirestore(deleteModal.month).catch(err =>
            console.error('Firestore delete error:', err)
          ),
          Promise.resolve(deleteMonthData(deleteModal.month, mode)),
        ]);
        // Optimistically remove from list
        setSavedMonths(prev => prev.filter(m => m !== deleteModal.month));
      } catch (err) {
        console.error('Delete error:', err);
        setError('Failed to delete month. Please try again.');
      } finally {
        setDeleteModal({ isOpen: false, month: '' });
      }
    };

    // ── Edit (rename) ─────────────────────────────────────────────────────────
    const handleEditClick = (month, e) => {
      e.stopPropagation();
      setEditModal({ isOpen: true, month });
      setEditValue(month);
      setEditError('');
    };

    const handleEditConfirm = async () => {
      const validationError = validateMonthStr(editValue);
      if (validationError) { setEditError(validationError); return; }

      const newMonth = normaliseMonth(editValue);

      // Don't do anything if the name hasn't changed
      if (newMonth === editModal.month) {
        setEditModal({ isOpen: false, month: '' });
        return;
      }

      // Check for duplicate
      if (savedMonths.includes(newMonth)) {
        setEditError(`"${newMonth}" already exists. Choose a different name.`);
        return;
      }

      try {
        // Load old data, save under new name, delete old entry
        const oldData = await loadMonthFromFirestore(editModal.month);
        if (oldData) {
          await saveMonthToFirestore(
            oldData.mode,
            newMonth,
            oldData.income,
            oldData.allocation,
            oldData.expenses || [],
            oldData.goals    || []
          );
        }
        await Promise.all([
          deleteMonthFromFirestore(editModal.month).catch(() => {}),
          Promise.resolve(deleteMonthData(editModal.month, mode)),
        ]);

        // Update local list preserving sort order
        setSavedMonths(prev =>
          prev.map(m => m === editModal.month ? newMonth : m)
        );
        setEditError('');
        setEditModal({ isOpen: false, month: '' });
      } catch (err) {
        console.error('Edit error:', err);
        setEditError('Failed to rename month. Please try again.');
      }
    };

    // ── Custom month entry ────────────────────────────────────────────────────
    const handleCustomConfirm = () => {
      const validationError = validateMonthStr(customMonth);
      if (validationError) { setCustomError(validationError); return; }
      setCustomError('');
      handleSelect(normaliseMonth(customMonth));
    };

    const currentMonth        = getCurrentMonth();
    const filteredSavedMonths = savedMonths.filter(m => m !== currentMonth);

    // ── Reusable month row ────────────────────────────────────────────────────
    const renderMonthRow = (month, isCurrent = false) => (
      <div key={month} className="flex items-center gap-2">
        <button
          onClick={() => handleSelect(month)}
          className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
            isCurrent
              ? 'bg-[var(--primary-color)] text-white shadow-lg hover:bg-[#d62839]'
              : 'bg-white text-[var(--primary-color)] border-2 border-[var(--primary-color)] hover:bg-[var(--primary-color)] hover:text-white'
          }`}
        >
          {isCurrent && <div className="icon-calendar-check text-sm flex-shrink-0"></div>}
          <span>{month}{isCurrent ? ' (Current)' : ''}</span>
        </button>

        {/* Edit button */}
        <button
          onClick={(e) => handleEditClick(month, e)}
          className="px-3 py-3 bg-gray-50 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-colors flex-shrink-0"
          title={`Rename ${month}`}
        >
          <div className="icon-pencil text-sm"></div>
        </button>

        {/* Delete button */}
        <button
          onClick={(e) => handleDeleteClick(month, e)}
          className="px-3 py-3 bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-xl transition-colors flex-shrink-0"
          title={`Delete ${month}`}
        >
          <div className="icon-trash-2 text-sm"></div>
        </button>
      </div>
    );

    return (
      <div
        className="min-h-screen flex items-center justify-center bg-white p-4"
        data-name="month-selector"
        data-file="components/MonthSelector.js"
      >
        {/* Delete confirmation modal */}
        <ConfirmModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, month: '' })}
          onConfirm={handleDeleteConfirm}
          title="Delete Month Data"
          message={`Delete all data for ${deleteModal.month}? This will remove it from all your devices and cannot be undone.`}
        />

        {/* Edit / rename modal */}
        {editModal.isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setEditModal({ isOpen: false, month: '' })}
          >
            <div className="absolute inset-0 bg-black bg-opacity-40"></div>
            <div
              className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-1">Rename Month</h3>
              <p className="text-sm text-gray-500 mb-4">
                Renaming <span className="font-medium text-gray-700">{editModal.month}</span>
              </p>

              {editError && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                  <div className="icon-circle-alert text-xs flex-shrink-0"></div>
                  <span>{editError}</span>
                </div>
              )}

              <input
                type="text"
                value={editValue}
                onChange={e => { setEditValue(e.target.value); setEditError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleEditConfirm()}
                placeholder="e.g. April 2025"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[var(--primary-color)] focus:outline-none transition-colors mb-4"
                autoFocus
              />

              <div className="flex gap-3">
                <button onClick={handleEditConfirm} className="btn-primary flex-1">
                  Save
                </button>
                <button
                  onClick={() => { setEditModal({ isOpen: false, month: '' }); setEditError(''); }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-md w-full animate-fade-in">
          <button
            onClick={onBack}
            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-[var(--primary-color)] transition-colors"
          >
            <div className="icon-arrow-left"></div>
            <span>Back</span>
          </button>

          <div className="card">
            <div className="flex items-center justify-center w-16 h-16 bg-red-50 rounded-xl mb-4 mx-auto border-2 border-red-100">
              <div className="icon-calendar text-2xl text-[var(--primary-color)]"></div>
            </div>
            <h2 className="text-3xl font-bold text-center mb-2">Select Month</h2>
            <p className="text-center text-gray-600 mb-8">Choose a month to track your budget</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm mb-4 flex items-center gap-2">
                <div className="icon-circle-alert text-sm flex-shrink-0"></div>
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3">
              {/* Current month — with edit and delete */}
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Current Month</p>
                {renderMonthRow(currentMonth, true)}
              </div>

              {/* Saved months — each with edit and delete */}
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-sm">
                  <div style={{
                    width: '18px', height: '18px',
                    border: '2px solid #f3f3f3',
                    borderTop: '2px solid #e63946',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}></div>
                  <span>Loading saved months…</span>
                </div>
              ) : filteredSavedMonths.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500 pt-2">
                    Saved Months
                    <span className="ml-1 text-gray-400 font-normal">({filteredSavedMonths.length})</span>
                  </p>
                  {filteredSavedMonths.map(month => renderMonthRow(month, false))}
                </div>
              ) : !loading && (
                <p className="text-center text-sm text-gray-400 py-2">No other saved months yet</p>
              )}

              {/* Custom month entry */}
              {!showCustom ? (
                <button
                  onClick={() => { setShowCustom(true); setCustomError(''); }}
                  className="btn-secondary w-full mt-2"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="icon-plus text-sm"></div>
                    <span>Enter a Different Month</span>
                  </div>
                </button>
              ) : (
                <div className="space-y-2 mt-2 p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm font-medium text-gray-600">Enter month manually</p>
                  <p className="text-xs text-gray-400">Format: Month Year — e.g. December 2025</p>

                  {customError && (
                    <div className="text-sm text-red-600 flex items-center gap-1">
                      <div className="icon-circle-alert text-xs"></div>
                      <span>{customError}</span>
                    </div>
                  )}

                  <input
                    type="text"
                    value={customMonth}
                    onChange={e => { setCustomMonth(e.target.value); setCustomError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleCustomConfirm()}
                    placeholder="e.g. December 2025"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[var(--primary-color)] focus:outline-none transition-colors"
                    autoFocus
                  />

                  <div className="flex gap-2">
                    <button onClick={handleCustomConfirm} className="btn-primary flex-1">Confirm</button>
                    <button
                      onClick={() => { setShowCustom(false); setCustomMonth(''); setCustomError(''); }}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  } catch (error) {
    console.error('MonthSelector component error:', error);
    return null;
  }
}
