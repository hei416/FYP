import java.util.Scanner;
import java.util.concurrent.ThreadLocalRandom;

public class PaperScissorsRock {
    public static void main(String[] arg) {
        new PaperScissorsRock().runApp();
    }

    //5% for this part
    int getUserInput() {
        //TODO       
    }

    //5% for this part
    int getComputerInput() {
        //TODO, be careful of what you need to print in this method
    }

    //5% for this part
    void findResult(int p1, int p2, String name1, String name2) {
        //TODO, be careful of what you need to print in this method
    }


    //20% for this part - 
    // You can also complete this method without referring the code below
    void groupGame(int numberOfPlayer) {
        int[] inputs = new int[numberOfPlayer];
        System.out.println("In a group game, step 1");
        //assign value to inputs  - 3%
        ....


        do {
            System.out.println("Get the winners");

            //12% - find the winners including filling the condition below
            ...

            if (_________) { 
                //no winners from this round, play again
                //all player that has not been eliminated yet, assign a new value to its inputs
                
                //2%
            } else if (winners.length == 1) {
                System.out.println("The only winner is: " + winners[0]);
                return;
            } else {
                //some players need to be eliminated

                //all winners will be assigned with a new value

                //3%
            }
        } while (true);
    }

    public void runApp() {
        System.out.println("In two players game - Step 1");
        int p1 = getUserInput();   //5%
        System.out.println("Step 2");
        int p2 = getComputerInput(); //5% 
        System.out.println("Step 3");
        findResult(p1, p2, "Kevin", "Computer");  //5%
        //argument 1: input for player 1
        //argument 2: input for player 2
        //argument 3: name for player 1
        //argument 4: name for player 2
        
        groupGame(6); //play a six players game   //20%

    }
}