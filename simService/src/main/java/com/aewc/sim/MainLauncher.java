package com.aewc.sim;

public class MainLauncher {
    public static void main(String[] args) {
        AircraftGenerator.generateAircrafts(30);


        new Thread(new RadarSimService()).start();

 
        new Thread(new IffSimService()).start();

        
        new Thread(new DataLinkService()).start();

        System.out.println("Simulation AEW&C démarrée : Radar, IFF et Datalink tournent en parallèle.");
    }
}
