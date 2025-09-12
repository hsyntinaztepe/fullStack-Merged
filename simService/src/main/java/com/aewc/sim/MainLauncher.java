package com.aewc.sim;

public class MainLauncher {
    public static void main(String[] args) {
        AircraftGenerator.generateAircrafts(5);
        // Lancer Radar
        new Thread(new RadarSimService()).start();

        // Lancer IFF
        new Thread(new IffSimService()).start();

        // Lancer Datalink
        new Thread(new DataLinkSimService()).start();

        System.out.println("Simulation AEW&C démarrée : Radar, IFF et Datalink tournent en parallèle.");
    }
}
