/**
 * Runs `work(session)` in a transaction: commits when it resolves, aborts and
 * rethrows when it fails. No automatic retry: a retried save() of an
 * already-saved document would send nothing. Requires a replica set (Atlas),
 * like withLastAdminGuard in user.service.
 */
const withTransaction = async (Model, work) => {
  const session = await Model.startSession();
  try {
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction().catch(() => {});
    }
    throw err;
  } finally {
    await session.endSession();
  }
};

module.exports = { withTransaction };
