-- CreateIndex
CREATE INDEX "User_schoolYearId_idx" ON "User"("schoolYearId");

-- CreateIndex
CREATE INDEX "User_tutorId_idx" ON "User"("tutorId");

-- CreateIndex
CREATE INDEX "Course_schoolYearId_idx" ON "Course"("schoolYearId");
