import StudentClassroomDetail from "./pages/StudentClassroomDetail";

const App = () => {
  return (
    <RouterProvider router={router}>
      <Route path="/" element={<Home />} />
      <Route path="/classrooms/:classroomId" element={<StudentClassroomDetail />} />
    </RouterProvider>
  );
};

export default App;