});

app.get("/api/admin/appointments", adminAuth, async (req, res) => {
  const date = normalizeText(req.query.date, 10);

  if (date && !isValidDateString(date)) {
    return res.status(400).json({ error: "Informe uma data válida." });
  }

  try {
    const sql = date
      ? "SELECT * FROM appointments WHERE date = ? ORDER BY time ASC"
      : "SELECT * FROM appointments ORDER BY date ASC, time ASC";
    const params = date ? [date] : [];
    const rows = await dbAll(
      "SELECT * FROM appointments ORDER BY date ASC, time ASC"
      sql,
      params
    );

    res.json(rows);
