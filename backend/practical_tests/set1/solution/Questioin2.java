public class Clock {
    private int second, hour, minute;
    public static void main(String[] arg) {
        Clock c = new Clock();
        c.setTime(24, 44, 40);
        c.setTime(14, 44, 58);
        System.out.println("Time for the clock:\t" + c);
        c.runs(1);
        System.out.println("Time for the clock after 1 sec:\t" + c);
        c.runs(100);
        System.out.println("Time for the clock after another 100 sec:\t" + c);
        c.runs(10000);
        System.out.println("Time for the clock after another 10000 sec:\t" + c);
        Clock c2 = new Clock();
        c2.setTime(c);
        c.runs(1);
        System.out.println("Time for first clock:\t" +c);
        System.out.println("Time for second clock:\t" +c2);
        
    }

    public Clock() {
        hour = minute = second = 0;
    }

    public void setTime(Clock anotherClock) {
        hour = anotherClock.hour;
        minute = anotherClock.minute;
        second = anotherClock.second;
    }

    public void setTime(int h, int m, int s) {
        if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) {
            System.out.println("Invalid time");
            return;
        }
        hour = h;
        minute = m;
        second = s;
    }

    //tick means 1 second passed
    private void tick() {
        second++;
        if (second == 60) {
            second = 0;
            minute++;
        }
        if (minute == 60) {
            minute = 0;
            hour++;
        }
        if (hour == 24) {
            hour = 0;
        }
    }

    // this avoid writing so many lines
    public void runs(int sec) {
        for (int i = 0; i < sec; i++)
            tick();
    }

    // public void runs(int sec) {
    //     //alternatively, do some math...
    //     int h = sec / 60 / 60;
    //     int m = (sec / 60 - h * 60);
    //     int s = sec - h * 60 * 60 - m * 60;
    //     second += s;
    //     if (second > 60) {
    //         second -= 60;
    //         m++;
    //     }
    //     minute += m;
    //     if (minute > 60) {
    //         minute -= 60;
    //         h++;
    //     }
    //     hour = (hour + h) % 24;
    // }
    @Override
    public String toString() {
        String hourText = (hour < 10 ? "0" : "") + hour;
        String minuteText = (minute < 10 ? "0" : "") + minute;
        String secondText = (second < 10 ? "0" : "") + second;

        return hourText + ":" + minuteText + ":" + secondText;
    }
}