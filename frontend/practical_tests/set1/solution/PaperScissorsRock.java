import java.util.Scanner;
import java.util.concurrent.ThreadLocalRandom;

public class PaperScissorsRock {
    public static void main(String[] arg) {
        new PaperScissorsRock().runApp();
    }

    int getUserInput() {
        //almost identical to the example on lecture notes. See Lecture 5
        do {
            Scanner scanner = new Scanner(System.in);
            try {
                System.out.print("Enter 1 for Paper, 2 for Scissor, 3 for Rock:  ");
                int input = scanner.nextInt();
                if (!(input < 1 || input > 3))
                    return input;
                System.out.println("Invalid input\n");
            } catch (Exception e) {
                System.out.println("Invalid input\n");
                scanner.nextLine();
            }
        } while (true);
    }

    //very straight forward too. make sure you understand the return type and you need 
    //to return an integer value
    int getComputerInput() {
        int input = ThreadLocalRandom.current().nextInt(1, 4);
        String result = "Computer plays ";
        switch (input) {
            case 1: result += "paper";
                    break;
            case 2: result += "scissor";
                    break;
            case 3: result += "rock";
                    break;
        }
        System.out.println(result);
        return input;
    }

    //the minus trick is not difficult to discover. Think carefully next time :)
    void findResult(int p1, int p2, String name1, String name2) {
        if (p1 == p2)
            System.out.println("Draw!");
        else if (p1 - p2 == 1 || p1 - p2 == - 2)
            System.out.println(name1 + " wins!");
        else
            System.out.println(name2 + " wins!");
    }


    boolean doThatPlayerWin(int[] inputs, int index) {
        if (inputs[index] == 0)
            return false;
        for (int i = 0; i < inputs.length; i++)
            if (inputs[i] != 0 && (inputs[i] - inputs[index] == 1 || inputs[i] - inputs[index] == -2))
                return false;
        return true;
    }

    int[] findWinnersFromGroup(int[] inputs) {
        int[] result = new int[inputs.length];
        int winners = 0;
        for (int i = 0; i < inputs.length; i++)
            if (doThatPlayerWin(inputs, i))
                result[winners++] = i;
        int[] newResult = new int[winners];
        for (int i = 0; i < winners; i++)
            newResult[i] = result[i];
        return newResult;
    }

    void groupGame(int numberOfPlayer) {
        int[] inputs = new int[numberOfPlayer];
        System.out.println("In a group game, step 1");
        for (int i = 0; i < numberOfPlayer; i++) {
            System.out.printf("Computer %d: ", i);
            inputs[i] = getComputerInput();
        }
        
        do {
            System.out.println("Get the winners");
            int[] winners = findWinnersFromGroup(inputs);
            if (winners.length == 0) { //no winners from this round, play again
                for (int i = 0; i < numberOfPlayer; i++)
                    if (inputs[i] != 0) {//not eliminated yet 
                        System.out.printf("Computer %d: ", i);
                        inputs[i] = getComputerInput();
                    }
            } else if (winners.length == 1) {
                System.out.println("The only winner is: " + winners[0]);
                return;
            } else {
                //eliminate those did not win
                for (int i = 0; i < numberOfPlayer; i++)
                    inputs[i] = 0; 
                for (int i = 0; i < winners.length; i++) {
                    System.out.printf("Computer %d qualifies to next round\n", winners[i]);
                    inputs[winners[i]] = getComputerInput();
                }
            }
        } while (true);
    }

    public void runApp() {
        System.out.println("In two players game - Step 1");
        int p1 = getUserInput();
        System.out.println("Step 2");
        int p2 = getComputerInput();
        System.out.println("Step 3");
        findResult(p1, p2, "Kevin", "Computer"); 
        //argument 1: input for player 1
        //argument 2: input for player 2
        //argument 3: name for player 1
        //argument 4: name for player 2
        
        groupGame(6); //play a six players game

    }
}