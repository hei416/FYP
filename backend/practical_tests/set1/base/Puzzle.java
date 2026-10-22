public class Puzzle {


    public static void main(String[] arg) {
        new Puzzle().runApp();
    }

    //5% for this part
    public void printPuzzle(boolean[][] puzzle) {

    }

    
    ______ rotateRightPuzzle(___________) { //2% for this line
        //5% for the content
    }

    
    _______ rotateLeftPuzzle(___________) {  //no mark for this line
        //5% for the content
    }


    
    _______ areSame(________ , __________) { //3% for this line
        //5% for this part
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
        System.out.printf("Is puzzle 1 and puzzle 2 the same? %b\n", areSame(puzzle1, puzzle3));

        System.out.println("The puzzle should not be rotated or modified after the methods");
        printPuzzle(puzzle1);
        printPuzzle(puzzle2);
        printPuzzle(puzzle3);

    }

}