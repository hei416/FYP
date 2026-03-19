public class Puzzle {


    public static void main(String[] arg) {
        new Puzzle().runApp();
    }


    public void printPuzzle(boolean[][] puzzle) {
        if (puzzle == null) return; //this is optional. Make a habit to check null
        for (int i = 0; i < puzzle.length; i++) {
            for (int j = 0; j < puzzle[i].length; j++)
                System.out.print(puzzle[i][j] ? '*' : '.');
            System.out.println();
        }

    }

    //very straight forward
    public boolean[][] rotateLeftPuzzle(boolean[][] puzzle) {
        return rotateRightPuzzle(rotateRightPuzzle(rotateRightPuzzle(puzzle)));
    }

    public boolean[][] rotateRightPuzzle(boolean[][] puzzle) {
        if (puzzle == null) return null;
        int row = puzzle.length;
        int col = puzzle[0].length;
        boolean[][] newPuzzle = new boolean[col][row];
        for (int i = 0; i < row; i++)
            for (int j = 0; j < col; j++) {
                newPuzzle[j][row - i - 1] = puzzle[i][j];
            }
        return newPuzzle;
    }

    //check if they are the same
    public boolean areSame(boolean[][] p1, boolean[][] p2) {
        boolean[][] p = p1;
        for (int i = 0; i < 4; i++, p=rotateRightPuzzle(p))  //rotate on each loop
            if (areSameWithoutRotation(p, p2))
                return true;
        return false;
    }

    //add a helper function
    private boolean areSameWithoutRotation(boolean[][] p1, boolean[][] p2) {
        if (p1.length != p2.length || p1[0].length != p2[0].length)
            return false;
        for (int i = 0; i < p1.length; i++)
            for (int j = 0; j < p1[0].length; j++)
                if (p1[i][j] != p2[i][j])
                    return false;
        return true;
    }

    public void runApp() {
        boolean[][] puzzle1 = {{true, true, false}, {false, true, true}};
        System.out.println("-----");
        printPuzzle(puzzle1);
        System.out.println("-----");
        boolean[][] puzzle2 = rotateRightPuzzle(puzzle1);
        
        printPuzzle(puzzle2);
        System.out.println("-----");
        boolean[][] puzzle3 = {{false, false, false}, {true, false, false}};
        
        printPuzzle(puzzle3);
        System.out.println("-----");

        System.out.printf("Is puzzle 1 and puzzle 2 the same? %b\n", areSame(puzzle1, puzzle2));
        System.out.printf("Is puzzle 1 and puzzle 3 the same? %b\n", areSame(puzzle1, puzzle3));

        System.out.println("The puzzle should not be rotated or modified after the methods");
        printPuzzle(puzzle1);
        printPuzzle(puzzle2);
        printPuzzle(puzzle3);

    }

}